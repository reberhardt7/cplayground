import * as React from 'react';
import * as joint from 'jointjs';

import { bindSocketToDebugger, BoundSocketListeners, releaseSocketFromDebugger } from '../server-comm';

import Rectangle = joint.shapes.standard.Rectangle;
import HeaderedRectangle = joint.shapes.standard.HeaderedRectangle;

interface Process {
    pid: number;
    ppid: number;
    pgid: number;
    command: string;
    fds: {[key: string]: {
        file: string;
        closeOnExec: boolean;
    };};
}

interface OpenFileEntry {
    position: number;
    flags: string[];
    refcount: number;
    vnode: string;
}

interface VNode {
    name: string;
    refcount: number;
}

interface ContainerInfo {
    processes: Process[];
    openFiles: {[key: string]: OpenFileEntry};
    vnodes: {[key: string]: VNode};
}

const FONT_SIZE = 12;

type DiagramProps = {
    socket?: SocketIOClient.Socket;
}

class Diagram extends React.Component<DiagramProps> {
    divRef: React.RefObject<HTMLDivElement>;

    graph: joint.dia.Graph;

    links: Array<joint.shapes.standard.Link>;

    // Opaque object containing functions that were bound to the socket as event listeners.
    // We just need to remember these so that we can unbind the functions if this component
    // unmounts.
    boundSocketListeners?: BoundSocketListeners;

    constructor(props: DiagramProps) {
        super(props);
        this.divRef = React.createRef();
    }

    componentDidMount(): void {
        this.graph = new joint.dia.Graph();

        const paper = new joint.dia.Paper({
            el: this.divRef.current,
            model: this.graph,
            // TODO: set a more reasonable width/height
            width: 2000,
            height: 2000,
            gridSize: 1,
        });

        // Click on header to minimize it
        paper.on('element:pointerdblclick', (ElementView) => {
            const currentElem = ElementView.model;
            let visibility = 'hidden';
            if (currentElem.attr('body/visibility') === 'hidden') {
                visibility = 'visible';
            }
            if (currentElem instanceof joint.shapes.standard.HeaderedRectangle) {
                const children = currentElem.getEmbeddedCells();
                const used: Array<string> = [];
                children.forEach((child) => {
                    child.attr('body/visibility', visibility);
                    if (visibility === 'hidden') {
                        this.links.forEach((link) => {
                            if (link.attributes.source.id === child.id) {
                                link.source(currentElem, { selector: 'header' });
                            }
                        });
                    } else {
                        this.links.forEach((link) => {
                            if (link.attributes.source.id === currentElem.id
                                && !used.includes(child.cid)) {
                                link.source(child, { selector: 'header' });
                                used.push(child.cid);
                            }
                        });
                    }
                });
                currentElem.attr('body/visibility', visibility);
            }
        });

        // Change dragging so that child nodes are anchored within their parents, and
        // dragging a child makes everything move as a unit:
        // https://stackoverflow.com/a/45440557
        paper.on('cell:pointermove', (cellView, evt): void => {
            if (cellView.model.isLink()) {
                return;
            }

            const parent = cellView.model.getAncestors()[0];

            // if we trying to move with embedded cell
            if (parent) {
                // cancel move for the child (currently dragged element)
                cellView.pointerup(evt);
                const view = paper.findViewByModel(parent);

                // substitute currently dragged element with the parent
                paper.sourceView = view;

                // get parent's position and continue dragging (with the parent, children
                // are updated automaticaly)
                const localPoint = paper.snapToGrid({ x: evt.clientX, y: evt.clientY });
                view.pointerdown(evt, localPoint.x, localPoint.y);
            }
        });

        if (this.props.socket) {
            this.bindToSocket(this.props.socket);
        }
    }

    componentDidUpdate(prevProps: Readonly<DiagramProps>): void {
        if (this.props.socket === prevProps.socket) {
            return;
        }

        // Handle changes in socket
        if (prevProps.socket) {
            this.detachFromSocket(prevProps.socket);
        }
        if (this.props.socket) {
            this.bindToSocket(this.props.socket);
        }
    }

    componentWillUnmount(): void {
        if (this.props.socket) {
            this.detachFromSocket(this.props.socket);
        }
    }

    bindToSocket = (socket: SocketIOClient.Socket): void => {
        this.boundSocketListeners = bindSocketToDebugger(socket, this.receiveUpdatedData);
    };

    detachFromSocket = (socket: SocketIOClient.Socket): void => {
        releaseSocketFromDebugger(socket, this.boundSocketListeners);
        this.boundSocketListeners = null;
    };

    receiveUpdatedData = (data: ContainerInfo): void => {
        this.graph.clear();
        this.drawDiagram(data);
    };

    drawDiagram = (data: ContainerInfo): void => {
        const { processes, openFiles, vnodes } = data;

        this.links = [];
        const cells: Array<joint.shapes.standard.Rectangle> = [];
        const vnodeTable: {[index: string]: joint.shapes.standard.Rectangle} = {};
        const fileTableIndeces: {[index: string]: joint.shapes.standard.HeaderedRectangle} = {};
        const inodes: Array<joint.shapes.standard.Rectangle> = [];

        // VNODE TABLE
        const generateVnode = (): {[index: string]: Rectangle} => {
            let xPosition = 0;
            const yPosition = 300;
            const vnodeKeys = Object.keys(vnodes);
            vnodeKeys.forEach((vKey) => {
                const vnodeRect = new joint.shapes.standard.Rectangle();
                const v = vnodes[vKey];
                vnodeRect.resize(150, 50);
                vnodeRect.position(xPosition, yPosition);
                vnodeRect.attr({
                    body: {
                        strokeWidth: 1,
                    },
                    label: {
                        // TODO:scale box if needed to fit longer text
                        text: `${v.name}\nrefcount: ${v.refcount}`,
                        fontSize: FONT_SIZE,
                        fontFamily: 'Courier',
                        textAnchor: 'front',
                        refX: '10',
                    },
                });

                vnodeTable[vKey] = vnodeRect;
                xPosition += 150;
            });
            return vnodeTable;
        };
        // FILETABLE
        const generateFileTable = (): {[index: string]: HeaderedRectangle} => {
            let xPosition = 0;
            const yPosition = 150;
            const fileKeys = Object.keys(openFiles);
            fileKeys.forEach((key) => {
                const fileRect = new joint.shapes.standard.HeaderedRectangle();
                const file = openFiles[key];
                fileRect.resize(150, 120);
                fileRect.position(xPosition, yPosition);
                // TODO: figure out cleaner way to format strings on labels
                let flagText = '';
                file.flags.forEach((flag: string) => {
                    flagText += flag;
                    flagText += '\n       ';
                });
                fileRect.attr({
                    body: {
                        strokeWidth: 1,
                    },
                    header: {
                        strokeWidth: 1,
                    },
                    headerText: {
                        text: `${key.substring(0, 6)}`,
                        fontSize: FONT_SIZE,
                        fontFamily: 'Courier',

                    },
                    bodyText: { // TODO: parse flags to list multiple, scale box if needed
                        text: `cursor: ${file.position} \nrefcount: ${file.refcount}\nflags: ${flagText}`,
                        fontSize: FONT_SIZE,
                        fontFamily: 'Courier',
                        textAnchor: 'front',
                        refX: '10',
                    },
                });
                // fileRect.addTo(graph);
                const inode = new joint.shapes.standard.Rectangle();
                inode.resize(15, 15);
                inode.position(xPosition + 5, yPosition + 95);
                inode.attr({
                    body: {
                        strokeWidth: 1,
                        fill: 'yellow',
                        fillOpacity: 0.5,
                    },
                });
                const link = new joint.shapes.standard.Link();
                link.source(inode);
                link.target(vnodeTable[file.vnode]);
                link.attr({
                    line: {
                        connection: true,
                        stroke: 'green',
                    },
                });
                this.links.push(link);
                fileRect.embed(inode); // TODO don't let inode leave fileRect
                inodes.push(inode);

                fileTableIndeces[key] = fileRect;
                xPosition += 150;
            });
            return fileTableIndeces;
        };

        const generateProcesses = (): void => {
            let xPosition = 0;
            const yPosition = 0;
            processes.forEach((process: Process) => {
                const pidWidth = (Object.keys(process.fds).length + 2) * 30;
                const rect2 = new joint.shapes.standard.HeaderedRectangle();
                rect2.resize(pidWidth, 120);
                rect2.position(xPosition, yPosition);
                rect2.attr({
                    body: {
                        strokeWidth: 1,
                    },
                    header: {
                        fill: 'yellow',
                        fillOpacity: 1,
                        strokeWidth: 1,
                    },
                    headerText: {
                        text: `command: ${process.command}\npid: ${process.pid}, ppid: ${process.ppid}`,
                        fontSize: FONT_SIZE,
                        fontFamily: 'Courier',
                        textAnchor: 'left',
                        'ref-x': -0.4 * pidWidth,
                    },
                });
                let offset = 10;
                cells.push(rect2);

                // FD TABLE
                Object.keys(process.fds).forEach((fdKey) => {
                    const fd = new joint.shapes.standard.Rectangle();
                    const fileKey = process.fds[parseInt(fdKey, 10)].file;
                    fd.resize(20, 20);
                    fd.position(xPosition + offset, yPosition + 50);
                    fd.attr({
                        body: {
                            strokeWidth: 1,
                        },
                        label: {
                            text: `${fdKey} `,
                            fontSize: FONT_SIZE,
                            fontFamily: 'Courier',
                            textAnchor: 'middle',
                        },
                    });

                    offset += 20;
                    cells.push(fd);
                    rect2.embed(fd);

                    const link = new joint.shapes.standard.Link();
                    link.source(fd, { anchor: { name: 'bottom' } });
                    link.target(fileTableIndeces[fileKey], { anchor: { name: 'top' } });
                    link.attr({
                        line: {
                            connection: true,
                            stroke: 'green',
                        },
                    });
                    this.links.push(link);
                });
                xPosition += pidWidth + 20;
            });
        };

        const draw = (): void => {
            Object.keys(vnodeTable).forEach((vnodeKey) => {
                this.graph.addCell(vnodeTable[vnodeKey]);
            });
            Object.keys(fileTableIndeces).forEach((fileTableKey) => {
                this.graph.addCell(fileTableIndeces[fileTableKey]);
            });
            this.graph.addCells(cells);
            this.graph.addCells(inodes);
            this.graph.addCells(this.links);
        };

        generateVnode();
        generateFileTable();
        generateProcesses();
        draw();
    };

    render(): React.ReactNode {
        return (
            <div className="diagram-container">
                <div id="diagram" ref={this.divRef} />
            </div>
        );
    }
}

export default Diagram;

import * as React from 'react';
import * as joint from 'jointjs';

import { bindSocketToDebugger, BoundSocketListeners, releaseSocketFromDebugger } from '../server-comm';

import Rectangle = joint.shapes.standard.Rectangle;
import HeaderedRectangle = joint.shapes.standard.HeaderedRectangle;
import Image = joint.shapes.standard.Image;

const pipe_icon = 'https://cdn0.iconfinder.com/data/icons/interior-buildings/48/37-512.png';
const terminal_icon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAOEAAADhCAMAAAAJbSJIAAAAeFBMVEX///8AAADs7Oyzs7P5+fn19fVDQ0OXl5ednZ15eXn7+/uMjIwSEhLx8fHT09PKysrj4+OsrKzDw8MvLy8aGhojIyM0NDRTU1ODg4Pd3d19fX2/v79LS0vm5uakpKRzc3NmZmYiIiJcXFwWFhY6OjoqKipra2tGRkaC45yjAAAEvElEQVR4nO2d63aqMBBGE7UFweK1ttaKl6Pt+7/h0R61BDLVkkAmOd/+OYJr9jJiZghRCAAAAAAAAAAAQCXL1/OB9J3BfJ0vtH75s+vcLHLIK35d1zlZZ6n4JTvX+TTApiD4ENIA/Wbeuwj2whQ8Kl4MX1xn0hjngZq7zqNBul9fQtdZNEpyNHx1nUSjREdD1zk0y0CIiescGiYTKfVSOlx1snxbib8OR51sPG8yK5vE1E9FevkpGavx/uVXdNl8clZYiz/aePd7wrMoxuPv+KqVBI2Z6y80qShQ+LQ+lGKrpRzNGGgNB2rd8X59IVHi69bSNEFrGKuG18vtmxpf6M5lh9awVCInl/hEjQsvGgJaw6eSySU+KsXfdSdz4y7D2TleNvSiKNEalk0u8WEpvm8vz/poDcfEFSVS40/tpWmA1vBRNXn7Plohbi1LE/S/+EqfqjB5UXp0nhSWRPG0KphsC/GsEH9sIT0LUOXh9aIyOijx64S144kgaSh32WmKtngrx9+Hp/iKLLrY8VOJPyWKwMPei8nMmcCbGBKGIQBD/4Gh/8DQf2DoPxXDcddvxjcNheckNw17t9+ENZXOAwy9A4Yw5A8MKUN/vOsapi+ZNs6PuoaRlJ/l+6M8MTCU8nmsfY0XRoZHIvZfSFNDKV87Laf8S8wNpfzQr/Vngg3D092ZltP+BXYMpdx3tYcxwJbhkTzRHukai4ZSpuVVKRyoPafRGUrZL69LcU9dwxW1Sm/HbTZXv7Z4oNaWPC6JM9xgVD0tiXVsM06zOcP6cNEnPkg+sznjCrgX65dNy9fVzye2hY0af/mpd9ywmM3Z6WJQg/WTwWzOVp/mIdYvqZk6n81Z7ERNiCtr7vaiY7XXRg3W1GUJabmbSA3WtbvZnP1+KTFYf+jNJT0a83qliY4wMVin1PE/PYgSUyfdTTM97148K7/NkQfiaGpexNnwyKQ6DQjMUDNYgzM8XVmVwRqgoRBPxVXFARpmG+WdgjPslleFh2XY0bSqQjIcajd/CcYwGW+1yfapE9L9I8XevONj3bBDbDoRUZ9g01g21A9PuXXYfLNpmIwP5ZO/2Du9HW7PcEQMT9dNcFuGE+IR4LXznqIVw4Ta2o3DzSgLhqPKA3v/mFU3gXOBsSE1PKdc7s+YGZL3nxitmDIxHFHTLYedtSr1DakGMIvLS4G6hhPquVjHHe4qVlcqMLhLUcWm4QuDO01V7BlyXftly5Dv+j07hrGr4u8OLBgeGF5eChgbsl8LbWi44TM7ozAyfHNe/N2BgaGz3tLvqGuY8yj+7gBPBcGQPzCEIX9gCEP+wBCG/IEhDPkDQxjyB4Yw5A8MYcgfGMKQPzCEIX9gCEP+wBCG/IEhDPkDQxjyB4Yw5A8MYcgfGMKQPzCEIX9gCEP+wBCG/IEhDPkDQxjyB4b/gyHP/8e5n95Nw1XHb0YVQ2rzoFAYCGJzuWA4iM3tg7xmQ+wAFQ6RGLpOoWGGonIxDQxB/uFYIKRCMwkIiq8pGrXdYwicN50hNuwMgN15Kpfo/n8jBA7X2WonTMXnwq6cSYgDdScUctf5WKeya3qShlRlzCJt8ZhFm6n/moP5R8R0X04AAAAAAAAAAA75C49zaS/t8QFIAAAAAElFTkSuQmCC';
const file_icon = 'https://s3.amazonaws.com/iconbros/icons/icon_pngs/000/000/211/original/document.png?1510299755'

const MOCK_DATA = {
    processes: [{
        pid: 20,
        ppid: 1,
        pgid: 1,
        command: 'output',
        fds: {
            0: {
                file: '6d2b62b056631445f3a906498f0ab45fea4c4e68a198af6f268a34269fb30caa',
                closeOnExec: false,
            },
            1: {
                file: '6d2b62b056631445f3a906498f0ab45fea4c4e68a198af6f268a34269fb30caa',
                closeOnExec: false,
            },
            2: {
                file: '6d2b62b056631445f3a906498f0ab45fea4c4e68a198af6f268a34269fb30caa',
                closeOnExec: false,
            },
            3: {
                file: '4877eb7123020cbb048bec0564324a4f2dcdc4c6d98c4b925da38f6d978fd24e',
                closeOnExec: false,
            },
        },
    }, {
        pid: 21,
        ppid: 20,
        pgid: 1,
        command: 'output',
        fds: {
            0: {
                file: '6d2b62b056631445f3a906498f0ab45fea4c4e68a198af6f268a34269fb30caa',
                closeOnExec: false,
            },
            1: {
                file: '2d7ed44fbc12ed3c63692795dd3fdbf0fb038841fcce65a20419938d04bae623',
                closeOnExec: false,
            },
            2: {
                file: '6d2b62b056631445f3a906498f0ab45fea4c4e68a198af6f268a34269fb30caa',
                closeOnExec: false,
            },
        },
    }],
    openFiles: {
        '6d2b62b056631445f3a906498f0ab45fea4c4e68a198af6f268a34269fb30caa': {
            position: 0,
            flags: [
                'O_RDWR',
                'S_IFREG',
            ],
            refcount: 5,
            vnode: '/dev/pts/0',
        },
        '4877eb7123020cbb048bec0564324a4f2dcdc4c6d98c4b925da38f6d978fd24e': {
            position: 0,
            flags: [
                'O_RDONLY',
            ],
            refcount: 1,
            vnode: 'pipe:[116131]',
        },
        '2d7ed44fbc12ed3c63692795dd3fdbf0fb038841fcce65a20419938d04bae623': {
            position: 0,
            flags: [
                'O_WRONLY',
            ],
            refcount: 1,
            vnode: 'pipe:[116131]',
        },
    },
    vnodes: {
        '/dev/pts/0': {
            name: '/dev/pts/0',
            refcount: 1,
        },
        'pipe:[116131]': {
            name: 'pipe:[116131]',
            refcount: 2,
        },
    },
};

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
        this.drawDiagram(MOCK_DATA); // TEST

        // Disable dragging of elements. (We may re-enable in the future, but for now, "proper"
        // behavior isn't well defined. E.g., if a process is dragged, and then a new process
        // appears, where should that new process be drawn? Should we make draw it pretending that
        // the dragged process was never dragged away, or, if the dragged process was dragged
        // totally out of the way, should we have the new process take its place in the flow of
        // nodes?)
        paper.setInteractivity({ elementMove: false });

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
            this.graph.clear();
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
        const icons: Array<joint.shapes.standard.Image> = [];

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
                const embeddedImage = new joint.shapes.standard.Image();
                if (v.name.substr(0, 8) === '/dev/pts') {
                    embeddedImage.attr('image/xlinkHref', terminal_icon);
                } else if (v.name.substr(0, 4) === 'pipe') {
                    embeddedImage.attr('image/xlinkHref', pipe_icon);
                } else {
                    embeddedImage.attr('image/xlinkHref', file_icon);
                }
                embeddedImage.resize(15, 15);
                embeddedImage.position(xPosition + 130, yPosition+5);
                icons.push(embeddedImage);
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
                const readIcon = new joint.shapes.standard.Image();
                readIcon.resize(15, 15);
                const writeIcon = new joint.shapes.standard.Image(); // TODO: use copy
                writeIcon.resize(15, 15);
                readIcon.position(xPosition + 115, yPosition + 10);
                writeIcon.position(xPosition + 130, yPosition + 10);
                if (file.flags.includes('O_WRONLY') || file.flags.includes('O_RDWR')) {
                    writeIcon.attr('image/xlinkHref', 'https://i.imgur.com/nCqRWeQ.png');
                }
                if (file.flags.includes('O_RDONLY') || file.flags.includes('O_RDWR')) {
                    readIcon.attr('image/xlinkHref', 'https://i.imgur.com/r88Gk5B.png');
                }

                icons.push(readIcon);
                icons.push(writeIcon);

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
            this.graph.addCells(icons);
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

import * as React from 'react';
import * as joint from 'jointjs';

import { Process, OpenFileEntry, VNode, ContainerInfo } from '../../common/communication';
import { PROCESS_COLORS } from './App';

import Rectangle = joint.shapes.standard.Rectangle;
import HeaderedRectangle = joint.shapes.standard.HeaderedRectangle;

const VERTICAL_SPACING = 50;
const PROCESS_X_SPACING = 20;
const PROCESS_HEIGHT = 80;
const PROCESS_Y = 0;
const FD_BOX_SIZE = 20;
const FD_TABLE_X_OFFSET = 15;
const FD_TABLE_Y_OFFSET = 45;
const OPEN_FILE_WIDTH = 150;
const OPEN_FILE_HEIGHT = 90;
const OPEN_FILE_Y = PROCESS_Y + PROCESS_HEIGHT + VERTICAL_SPACING;
const VNODE_WIDTH = OPEN_FILE_WIDTH;
const VNODE_HEIGHT = 50;
const VNODE_Y = OPEN_FILE_Y + OPEN_FILE_HEIGHT + VERTICAL_SPACING;
const POINTER_BOX_SIZE = 15;
const POINTER_BOX_OFFSET = 10; // offset from left and bottom
const ICON_SIZE = 15;
const ICON_X_OFFSET = 5; // offset from right side of box to right side of icon
const ICON_Y_OFFSET = 5;
const ICON_SPACING = 2;

// TODO: make sure there are no copyright issues here
const PIPE_ICON = 'https://cdn0.iconfinder.com/data/icons/interior-buildings/48/37-512.png';
const TERMINAL_ICON = (
    'data:image/png;base64,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'
);
const FILE_ICON = 'https://s3.amazonaws.com/iconbros/icons/icon_pngs/000/000/211/original/document.png?1510299755';

const FONT_SIZE = 12;

type OpenFilesDiagramProps = {
    data: ContainerInfo | null;
    pidColorMap: {[pid: number]: string};
}

class OpenFilesDiagram extends React.Component<OpenFilesDiagramProps> {
    divRef: React.RefObject<HTMLDivElement>;

    graph: joint.dia.Graph;

    links: Array<joint.shapes.standard.Link>;

    constructor(props: OpenFilesDiagramProps) {
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
            height: 320,
            gridSize: 1,
        });

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
                                link.source(child, {
                                    selector: 'header',
                                    anchor: { name: 'bottom' },
                                });
                                used.push(child.cid);
                            }
                        });
                    }
                });
                currentElem.attr('body/visibility', visibility);
            }
        });

        if (this.props.data) {
            this.drawDiagram();
        }
    }

    componentDidUpdate(prevProps: Readonly<OpenFilesDiagramProps>): void {
        if (prevProps.data !== this.props.data) {
            this.graph.clear();
            if (this.props.data) {
                this.drawDiagram();
            }
        }
    }

    drawDiagram = (): void => {
        this.links = [];

        const vnodeTable = this.drawVnodeTable(this.props.data.vnodes);
        const openFileTable = this.drawOpenFileTable(this.props.data.openFiles, vnodeTable);
        this.drawFileDescriptorTables(this.props.data.processes, openFileTable);
    };

    drawVnodeTable = (vnodes: {[vnodeId: string]: VNode}): {[index: string]: Rectangle} => {
        const vnodeTable: {[index: string]: Rectangle} = {};
        const vnodeKeys = Object.keys(vnodes);
        vnodeKeys.forEach((vKey, i) => {
            const xPosition = i * VNODE_WIDTH;
            const vnodeRect = new joint.shapes.standard.Rectangle();
            const v = vnodes[vKey];
            vnodeRect.resize(VNODE_WIDTH, VNODE_HEIGHT);
            vnodeRect.position(xPosition, VNODE_Y);
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
            this.graph.addCell(vnodeRect);
            vnodeTable[vKey] = vnodeRect;

            // Draw icon indicating file type
            const embeddedImage = new joint.shapes.standard.Image();
            if (v.name.startsWith('/dev/pts')) {
                embeddedImage.attr('image/xlinkHref', TERMINAL_ICON);
            } else if (v.name.startsWith('pipe')) {
                embeddedImage.attr('image/xlinkHref', PIPE_ICON);
            } else {
                embeddedImage.attr('image/xlinkHref', FILE_ICON);
            }
            embeddedImage.resize(ICON_SIZE, ICON_SIZE);
            // TODO: use constants for offsets
            embeddedImage.position(
                xPosition + VNODE_WIDTH - ICON_X_OFFSET - ICON_SIZE,
                VNODE_Y + ICON_Y_OFFSET,
            );
            this.graph.addCell(embeddedImage);
            vnodeRect.embed(embeddedImage);
        });
        return vnodeTable;
    };

    drawOpenFileTable = (
        openFiles: {[fileId: string]: OpenFileEntry},
        vnodeTable: {[vnodeId: string]: Rectangle},
    ): {[index: string]: Rectangle} => {
        const openFileTable: {[fileId: string]: Rectangle} = {};
        const fileKeys = Object.keys(openFiles);
        fileKeys.forEach((key, i) => {
            const xPosition = i * OPEN_FILE_WIDTH;
            const fileRect = new joint.shapes.standard.Rectangle();
            const file = openFiles[key];
            fileRect.resize(OPEN_FILE_WIDTH, OPEN_FILE_HEIGHT);
            fileRect.position(i * OPEN_FILE_WIDTH, OPEN_FILE_Y);
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
                label: { // TODO: parse flags to list multiple, scale box if needed
                    text: `cursor: ${file.position} \n`
                        + `refcount: ${file.refcount}\n`
                        + `flags: ${flagText}`,
                    fontSize: FONT_SIZE,
                    fontFamily: 'Courier',
                    textAnchor: 'front',
                    refX: '10',
                },
            });
            openFileTable[key] = fileRect;
            this.graph.addCell(fileRect);

            // Add icon indicating whether this file is readable/writable
            const showReadIcon = file.flags.includes('O_RDONLY') || file.flags.includes('O_RDWR');
            const showWriteIcon = file.flags.includes('O_WRONLY') || file.flags.includes('O_RDWR');
            let iconX = xPosition + VNODE_WIDTH - ICON_X_OFFSET - ICON_SIZE;
            if (showWriteIcon) {
                const writeIcon = new joint.shapes.standard.Image(); // TODO: use copy
                writeIcon.resize(ICON_SIZE, ICON_SIZE);
                writeIcon.position(iconX, OPEN_FILE_Y + ICON_Y_OFFSET);
                writeIcon.attr('image/xlinkHref', '/img/write-icon.png');
                fileRect.embed(writeIcon);
                this.graph.addCell(writeIcon);
                iconX -= ICON_SIZE + ICON_SPACING;
            }
            if (showReadIcon) {
                const readIcon = new joint.shapes.standard.Image();
                readIcon.resize(ICON_SIZE, ICON_SIZE);
                readIcon.position(iconX, OPEN_FILE_Y + ICON_Y_OFFSET);
                readIcon.attr('image/xlinkHref', '/img/read-icon.png');
                fileRect.embed(readIcon);
                this.graph.addCell(readIcon);
            }

            // Add little box storing pointer to vnode
            const vnodePointerBox = new joint.shapes.standard.Rectangle();
            vnodePointerBox.resize(POINTER_BOX_SIZE, POINTER_BOX_SIZE);
            vnodePointerBox.position(
                xPosition + POINTER_BOX_OFFSET,
                OPEN_FILE_Y + OPEN_FILE_HEIGHT - POINTER_BOX_OFFSET - POINTER_BOX_SIZE,
            );
            vnodePointerBox.attr({
                body: {
                    strokeWidth: 1,
                    fill: 'yellow',
                    fillOpacity: 0.5,
                },
            });
            this.graph.addCell(vnodePointerBox);
            fileRect.embed(vnodePointerBox); // TODO don't let inode leave fileRect
            // Draw pointer to vnode table
            const link = new joint.shapes.standard.Link();
            link.source(vnodePointerBox, { anchor: { name: 'center' } });
            link.target(vnodeTable[file.vnode]);
            link.attr({
                line: {
                    connection: true,
                    stroke: PROCESS_COLORS[0],
                },
            });
            this.links.push(link);
            this.graph.addCell(link);
        });

        return openFileTable;
    };

    drawFileDescriptorTables = (
        processes: Process[],
        openFileTable: {[fileId: string]: HeaderedRectangle},
    ): void => {
        let xPosition = 0;
        processes.forEach((process: Process, i: number) => {
            // TODO: set this based on the command name, so that the text never overflows
            const minWidth = 180;
            const numFds = (
                Math.max(...Object.keys(process.fds).map((fd: string) => parseInt(fd, 10))) + 1
            );
            const fdTableWidth = numFds * FD_BOX_SIZE;
            const width = Math.max(minWidth, FD_TABLE_X_OFFSET * 2 + fdTableWidth);

            const processRect = new joint.shapes.standard.HeaderedRectangle();
            processRect.resize(width, PROCESS_HEIGHT);
            processRect.position(xPosition, PROCESS_Y);
            processRect.attr({
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
                    'ref-x': -0.4 * width, // TODO: what's this? / how does it work?
                },
            });
            this.graph.addCell(processRect);

            // Draw file descriptor table
            for (let fd = 0; fd < numFds; fd += 1) {
                this.drawFileDescriptor(process, i, processRect, fd, openFileTable);
            }

            xPosition += width + PROCESS_X_SPACING;
        });
    };

    drawFileDescriptor = (
        process: Process,
        processIdx: number,
        processRect: HeaderedRectangle,
        fd: number,
        openFileTable: {[fileId: string]: HeaderedRectangle},
    ): void => {
        const fdRect = new joint.shapes.standard.Rectangle();
        fdRect.resize(FD_BOX_SIZE, FD_BOX_SIZE);
        fdRect.position(
            processRect.getBBox().topLeft().x + FD_TABLE_X_OFFSET + fd * FD_BOX_SIZE,
            PROCESS_Y + FD_TABLE_Y_OFFSET,
        );
        fdRect.attr({
            body: {
                strokeWidth: 1,
            },
            label: {
                text: `${fd} `,
                fontSize: FONT_SIZE,
                fontFamily: 'Courier',
                textAnchor: 'middle',
            },
        });
        this.graph.addCell(fdRect);
        processRect.embed(fdRect);

        // Draw arrow from file descriptor to open file table
        if (process.fds[String(fd)] !== undefined) {
            const fileId = process.fds[String(fd)].file;
            const link = new joint.shapes.standard.Link();
            link.source(fdRect, { anchor: { name: 'bottom' } });
            link.target(openFileTable[fileId], { anchor: { name: 'top' } });
            link.attr({
                line: {
                    connection: true,
                    stroke: this.props.pidColorMap[process.pid],
                },
            });
            this.links.push(link);
            this.graph.addCell(link);
        }
    };

    render(): React.ReactNode {
        return (
            <div id="diagram" ref={this.divRef} />
        );
    }
}

export default OpenFilesDiagram;

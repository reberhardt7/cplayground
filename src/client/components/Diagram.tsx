import * as React from 'react';
import * as joint from 'jointjs';

const FONT_SIZE = 9;
const MOCK_DATA = {
    processes: [{
        pid: 123,
        ppid: 122,
        pgid: 10,
        threads: [{
            tid: 123,
            state: 'S (sleeping)',
            cpusAllowed: [0, 1, 2, 3, 4, 5, 6, 7],
            pendingSignals: [
                'SIGINT',
            ],
            blockedSignals: [
                'SIGINT',
            ],
            ignoredSignals: [
                'SIGTSTP',
            ],
        }],
        fds: {
            0: {
                file: 'someid0',
                closeOnExec: false,
            },
            1: {
                file: 'someid0',
                closeOnExec: false,
            },
            2: {
                file: 'someid0',
                closeOnExec: false,
            },
            3: {
                file: 'someid3',
                closeOnExec: true,
            },
            4: {
                file: 'someid3',
                closeOnExec: false,
            },
            5: {
                file: 'someid0',
                closeOnExec: false,
            },
            6: {
                file: 'someid0',
                closeOnExec: false,
            },
            7: {
                file: 'someid0',
                closeOnExec: false,
            },
            8: {
                file: 'someid3',
                closeOnExec: true,
            },
            9: {
                file: 'someid3',
                closeOnExec: false,
            },
        },
    }, {
        pid: 123,
        ppid: 122,
        pgid: 10,
        threads: [{
            tid: 123,
            state: 'S (sleeping)',
            cpusAllowed: [0, 1, 2, 3, 4, 5, 6, 7],
            pendingSignals: [
                'SIGINT',
            ],
            blockedSignals: [
                'SIGINT',
            ],
            ignoredSignals: [
                'SIGTSTP',
            ],
        }],
        fds: {
            0: {
                file: 'someid0',
                closeOnExec: false,
            },
            1: {
                file: 'someid0',
                closeOnExec: false,
            },
            2: {
                file: 'someid0',
                closeOnExec: false,
            },
            3: {
                file: 'someid3',
                closeOnExec: true,
            },
            4: {
                file: 'someid3',
                closeOnExec: false,
            },
        },
    }],
    openFiles: {
        someid0: {
            position: 123, // offset in file
            flags: ['O_WRONLY', 'O_RDONLY'],
            refcount: 3,
            vnode: 'vnode0',
        },
        someid3: {
            position: 123, // offset in file
            flags: ['O_RDONLY'],
            refcount: 2,
            vnode: 'vnode1',
        },
    },
    vnodes: {
        vnode0: {
            name: '/dev/pts/2',
            refcount: 1,
            inode: {
                mode: '0700',
                owner: 'cplayground',
            },
        },
        vnode1: {
            name: '/path/to/file',
            refcount: 1,
            inode: {
                mode: '0755',
                owner: 'root',
            },
        },
    },
};

type DiagramProps = {
}

class Diagram extends React.Component<DiagramProps> {
    divRef: React.RefObject<HTMLDivElement>;

    constructor(props: Diagram) {
        super(props);
        this.divRef = React.createRef();
    }

    componentDidMount(): void {
        const graph = new joint.dia.Graph();

        // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
        const paper = new joint.dia.Paper({
            el: this.divRef.current,
            model: graph,
            width: this.divRef.current.getBoundingClientRect().width,
            height: this.divRef.current.getBoundingClientRect().height,
            gridSize: 1,
        });
        paper.setInteractivity({ elementMove: false });

        const myObjStr = JSON.stringify(MOCK_DATA);
        const data = JSON.parse(myObjStr);
        const { processes } = data;
        const { openFiles } = data;
        const { vnodes } = data;

        const links: Array<joint.shapes.standard.Link> = [];
        const cells: Array<joint.shapes.standard.Rectangle> = [];
        const vnodeTable: {[index: string]: joint.shapes.standard.Rectangle} = {};
        const fileTableIndeces: {[index: string]: joint.shapes.standard.HeaderedRectangle} = {};
        const inodes: Array<joint.shapes.standard.Rectangle> = [];

        // VNODE TABLE
        function generateVnode(): {} {
            let xPosition = 0;
            const yPosition = 250;
            const vnodeKeys = Object.keys(vnodes);
            vnodeKeys.forEach((vKey) => {
                const vnodeRect = new joint.shapes.standard.Rectangle();
                const v = vnodes[vKey];
                vnodeRect.resize(100, 80);
                vnodeRect.position(xPosition, yPosition);
                vnodeRect.attr({
                    body: {
                        strokeWidth: 1,
                    },
                    label: {
                        // TODO:scale box if needed to fit longer text
                        text: `${v.name}\nrefcount: ${v.refcount}\ninode:`,
                        fontSize: FONT_SIZE,
                        fontFamily: 'Courier',
                        textAnchor: 'front',
                        'ref-x': -45,
                        'ref-y': -20,
                    },
                });

                const inode = new joint.shapes.standard.Rectangle();
                inode.resize(80, 40);
                inode.position(xPosition + 5, yPosition + 35);
                inode.attr({
                    body: {
                        strokeWidth: 1,
                        fill: 'blue',
                        fillOpacity: 0.1,
                    },
                    label: {
                        text: `${v.inode.mode} \n${v.inode.owner}`,
                        fontSize: FONT_SIZE,
                        fontFamily: 'Courier',
                        textAnchor: 'front',
                        'ref-x': -35,
                    },
                });
                cells.push(inode);
                vnodeRect.embed(inode);
                vnodeTable[vKey] = vnodeRect;
                xPosition += 100;
            });
            return vnodeTable;
        }
        // FILETABLE
        function generateFileTable(): {} {
            let xPosition = 0;
            const yPosition = 140;
            const fileKeys = Object.keys(openFiles);
            fileKeys.forEach((key) => {
                const fileRect = new joint.shapes.standard.HeaderedRectangle();
                const file = openFiles[key];
                fileRect.resize(100, 100);
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
                        text: `${key}`,
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
                inode.position(xPosition + 5, yPosition + 80);
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
                links.push(link);
                fileRect.embed(inode); // TODO don't let inode leave fileRect
                inodes.push(inode);

                fileTableIndeces[key] = fileRect;
                xPosition += 100;
            });
            return fileTableIndeces;
        }

        function generateProcesses(): void {
            let xPosition = 0;
            const yPosition = 30;
            // TODO: create interface? for process, currently getting 'any' casting warnings
            processes.forEach((process: any) => {
                const pidWidth = (Object.keys(process.fds).length + 2) * 20;
                const rect2 = new joint.shapes.standard.HeaderedRectangle();
                rect2.resize(pidWidth, 100);
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
                        text: `pid: ${process.pid} \nppid: ${process.ppid} `,
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
                    link.source(fd);
                    link.target(fileTableIndeces[fileKey]);
                    link.attr({
                        line: {
                            connection: true,
                            stroke: 'green',
                        },
                    });
                    links.push(link);
                });
                xPosition += pidWidth + 20;
            });
        }

        function draw(): void {
            Object.keys(vnodeTable).forEach((vnodeKey) => {
                graph.addCell(vnodeTable[vnodeKey]);
            });
            Object.keys(fileTableIndeces).forEach((fileTableKey) => {
                graph.addCell(fileTableIndeces[fileTableKey]);
            });
            graph.addCells(cells);
            graph.addCells(inodes);
            graph.addCells(links);
        }

        generateVnode();
        generateFileTable();
        generateProcesses();
        draw();

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
                        links.forEach((link) => {
                            if (link.attributes.source.id === child.id) {
                                link.source(currentElem, { selector: 'header' });
                            }
                        });
                    } else {
                        links.forEach((link) => {
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
    }


    componentWillUnmount(): void {
        // TODO: put something here
    }

    render(): React.ReactNode {
        return (
            <div className="diagram-container">
                <div id="diagram" ref={this.divRef} />
            </div>
        );
    }
}

export default Diagram;

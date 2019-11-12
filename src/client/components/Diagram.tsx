import * as React from 'react';
import * as joint from 'jointjs';

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
        },
    }],
    openFiles: {
        someid0: {
            position: 123, // offset in file
            flags: ['O_WRONLY'],
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

        const rect = new joint.shapes.standard.Rectangle();
        rect.position(100, 30);
        rect.resize(100, 40);
        rect.attr({
            body: {
                fill: 'blue',
            },
            label: {
                text: 'Hello',
                fill: 'white',
            },
        });
        rect.addTo(graph);

        const rect2 = rect.clone() as joint.shapes.standard.Rectangle;
        rect2.translate(300, 0);
        rect2.attr('label/text', 'World!');
        rect2.addTo(graph);

        const link = new joint.shapes.standard.Link();
        link.source(rect);
        link.target(rect2);
        link.addTo(graph);
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

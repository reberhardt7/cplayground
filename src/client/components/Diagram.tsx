import * as React from 'react';
import * as joint from 'jointjs';

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

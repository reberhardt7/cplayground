import * as React from 'react';

type DiagramProps = {
}

class Diagram extends React.Component<DiagramProps> {
    divRef: React.RefObject<HTMLDivElement>;

    constructor(props: Diagram) {
        super(props);
        this.divRef = React.createRef();
    }

    componentDidMount(): void {
        // TODO: put something here
    }

    componentWillUnmount(): void {
        // TODO: put something here
    }

    render(): React.ReactNode {
        return (
            <div className="diagram-container">
                <div ref={this.divRef} />
            </div>
        );
    }
}

export default Diagram;

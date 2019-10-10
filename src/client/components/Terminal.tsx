import * as React from 'react';

class Terminal extends React.PureComponent {
    render(): React.ReactNode {
        return (
            <div className="terminal-container">
                <div id="terminal" />
            </div>
        );
    }
}

export default Terminal;

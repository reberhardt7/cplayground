import * as React from 'react';

import Terminal from './Terminal';
import Diagram from './Diagram';

type ProgramPaneProps = {
    socket?: SocketIOClient.Socket;
    onResize?: (rows: number, cols: number) => void;
}

const ProgramPane: React.FunctionComponent<ProgramPaneProps> = (props: ProgramPaneProps) => (
    <div className="program-pane">
        <Terminal socket={props.socket} onResize={props.onResize} />
        <Diagram />
    </div>
);

export default ProgramPane;

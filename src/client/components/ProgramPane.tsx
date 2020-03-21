import * as React from 'react';

import Terminal from './Terminal';
import Debugger from './Debugger';

type ProgramPaneProps = {
    socket?: SocketIOClient.Socket;
    onResize?: (rows: number, cols: number) => void;
}

const ProgramPane: React.FunctionComponent<ProgramPaneProps> = (props: ProgramPaneProps) => (
    <div className="program-pane">
        <Terminal socket={props.socket} onResize={props.onResize} />
        <Debugger socket={props.socket} />
    </div>
);

export default ProgramPane;

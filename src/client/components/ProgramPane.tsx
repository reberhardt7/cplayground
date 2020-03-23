import * as React from 'react';

import Terminal from './Terminal';
import Debugger from './Debugger';
import { DebugServer } from '../server-comm';
import { ContainerInfo } from '../../common/communication';

type ProgramPaneProps = {
    socket?: SocketIOClient.Socket;
    debugServer?: DebugServer;
    debugData?: ContainerInfo;
    pidColorMap?: {[pid: number]: string};
    onResize?: (rows: number, cols: number) => void;
}

const ProgramPane: React.FunctionComponent<ProgramPaneProps> = (props: ProgramPaneProps) => (
    <div className="program-pane">
        <Terminal socket={props.socket} onResize={props.onResize} />
        <Debugger
            debugServer={props.debugServer}
            debugData={props.debugData}
            pidColorMap={props.pidColorMap}
        />
    </div>
);

export default ProgramPane;

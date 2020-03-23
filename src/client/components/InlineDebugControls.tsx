import * as React from 'react';
import ReactDOM from 'react-dom';

import { Thread } from '../../common/communication';
import { DebugServer } from '../server-comm';
import Pill from './Pill';
import DebugControls from './DebugControls';

type InlineDebugControlsProps = {
    pid: number;
    color: string;
    thread: Thread;
    debugServer: DebugServer;
}

const InlineDebugControls:
    React.FunctionComponent<InlineDebugControlsProps> = (props: InlineDebugControlsProps) => (
        <>
            <Pill text={props.pid.toString()} color={props.color} />
            <DebugControls thread={props.thread} debugServer={props.debugServer} />
        </>
    );

export default InlineDebugControls;

export function generateInlineDebugControlNode(
    pid: number, color: string, thread: Thread, debugServer: DebugServer,
): HTMLDivElement {
    const controlWidget = document.createElement('div');
    controlWidget.className = 'inline-controls';
    ReactDOM.render((
        <InlineDebugControls
            pid={pid}
            color={color}
            thread={thread}
            debugServer={debugServer}
        />
    ), controlWidget);
    return controlWidget;
}

import * as React from 'react';
import ReactDOM from 'react-dom';

import { Process, Thread } from '../../common/communication';
import { DebugServer } from '../server-comm';
import Pill from './Pill';
import DebugControls from './DebugControls';

type InlineDebugControlsProps = {
    process: Process;
    processColor: string;
    thread: Thread;
    threadColor: string;
    debugServer: DebugServer;
}

const InlineDebugControls:
    React.FunctionComponent<InlineDebugControlsProps> = (props: InlineDebugControlsProps) => (
        <>
            <Pill text={props.process.pid.toString()} color={props.processColor}>
                <Pill text={props.thread.debuggerId.toString()} color={props.threadColor} />
            </Pill>
            <DebugControls thread={props.thread} debugServer={props.debugServer} />
        </>
    );

export default InlineDebugControls;

export function generateInlineDebugControlNode(
    process: Process, processColor: string, thread: Thread, threadColor: string,
    debugServer: DebugServer,
): HTMLDivElement {
    const controlWidget = document.createElement('div');
    controlWidget.className = 'inline-controls';
    ReactDOM.render((
        <InlineDebugControls
            process={process}
            processColor={processColor}
            thread={thread}
            threadColor={threadColor}
            debugServer={debugServer}
        />
    ), controlWidget);
    return controlWidget;
}

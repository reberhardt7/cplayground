import * as React from 'react';

import Pill from './Pill';
import { Process as ProcessType, ProcessRunState } from '../../common/communication';
import { DebugServer } from '../server-comm';
import DebugControls from './DebugControls';

type ProcessProps = {
    process: ProcessType;
    debugServer: DebugServer;
    color: string;
    children?: React.ReactNode;
}

export default function ProcessRow(props: ProcessProps): React.ReactElement {
    const thread = props.process.threads.length && props.process.threads[0];
    let statusText: string = null;
    if (thread) {
        statusText = thread.status
            + (thread.status === 'stopped' && thread.currentLine ? ` at line ${thread.currentLine}` : '');
    } else if (props.process.runState === ProcessRunState.Zombie) {
        // "zombie" / unreaped is a processwide, not per-thread, state
        // in fact, when in this state, we won't have threads
        // create the friendly status here
        statusText = 'zombie';
    }
    return (
        <div className="process">
            <div className="process-header">
                <Pill text={`pid ${props.process.pid}`} color={props.color} />
                {props.process.command}
                {statusText && ` (${statusText})`}
                {(props.process.threads[0] && (
                    <DebugControls
                        debugServer={props.debugServer}
                        thread={props.process.threads[0]}
                    />
                ))}
            </div>
            {props.children && (
                <div className="process-body">
                    {props.children}
                </div>
            )}
            {/* <table className="process-body">
                <tbody>
                    <tr>
                        <!-- stack frames and variables... -->
                    </tr>
                </tbody>
            </table> */}
        </div>
    );
}

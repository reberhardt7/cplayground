import * as React from 'react';

import Pill from './Pill';
import { Process as ProcessType } from '../../common/communication';
import { DebugServer } from '../server-comm';
import DebugControls from './DebugControls';

type ProcessProps = {
    process: ProcessType;
    debugServer: DebugServer;
    color: string;
}

const Process: React.FunctionComponent<ProcessProps> = (props: ProcessProps) => {
    const thread = props.process.threads.length && props.process.threads[0];
    let statusText: string = null;
    if (thread) {
        statusText = thread.status
            + (thread.status === 'stopped' && thread.stoppedAt ? ` at line ${thread.stoppedAt}` : '');
    } else if (props.process.runState === 'Z') {
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
            {/* <table className="process-body">
                <tbody>
                    <tr>
                        <!-- stack frames and variables... -->
                    </tr>
                </tbody>
            </table> */}
        </div>
    );
};

type ProcessesListingProps = {
    processes: ProcessType[];
    debugServer: DebugServer;
    pidColorMap: {[pid: number]: string};
};

const ProcessesListing:
    React.FunctionComponent<ProcessesListingProps> = (props: ProcessesListingProps) => (
        <div className="processes-listing">
            {props.processes.map((proc) => (
                <Process
                    key={proc.pid}
                    process={proc}
                    debugServer={props.debugServer}
                    color={props.pidColorMap[proc.pid]}
                />
            ))}
        </div>
    );

export default ProcessesListing;

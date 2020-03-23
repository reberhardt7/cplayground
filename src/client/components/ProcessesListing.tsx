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

const Process: React.FunctionComponent<ProcessProps> = (props: ProcessProps) => (
    <div className="process">
        <div className="process-header">
            <Pill text={`pid ${props.process.pid}`} color={props.color} />
            {props.process.command}
            {props.process.threads.length
            && <DebugControls debugServer={props.debugServer} thread={props.process.threads[0]} />}
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

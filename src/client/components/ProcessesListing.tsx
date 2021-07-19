import * as React from 'react';

import { Process as ProcessType } from '../../common/communication';
import { DebugServer } from '../server-comm';
import ProcessRow from './ProcessRow';

type ProcessesListingProps = {
    processes: ProcessType[];
    debugServer: DebugServer;
    pidColorMap: {[pid: number]: string};
};

const ProcessesListing:
    React.FunctionComponent<ProcessesListingProps> = (props: ProcessesListingProps) => (
        <div className="processes-listing">
            {props.processes.map((proc) => (
                <ProcessRow
                    key={proc.pid}
                    process={proc}
                    debugServer={props.debugServer}
                    color={props.pidColorMap[proc.pid]}
                />
            ))}
        </div>
    );

export default ProcessesListing;

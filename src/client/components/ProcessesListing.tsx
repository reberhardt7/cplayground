import * as React from 'react';

import { PROCESS_COLORS } from './Debugger';
import Pill from './Pill';
import Button from './Button';
import { Process as ProcessType, Thread } from '../../common/communication';

type ProcessProps = {
    process: ProcessType;
    index: number;
    onProceed: (thread: Thread) => void;
    onNext: (thread: Thread) => void;
    onStepIn: (thread: Thread) => void;
}

const Process: React.FunctionComponent<ProcessProps> = (props: ProcessProps) => (
    <div className="process">
        <div className="process-header">
            <Pill text={`pid ${props.process.pid}`} color={PROCESS_COLORS[props.index]} />
            {props.process.command}
            <div className="debug-controls">
                {props.process.threads.length && props.process.threads[0].status === 'stopped' && (
                    <>
                        <Button
                            title="Continue execution"
                            onClick={(): void => props.onProceed(props.process.threads[0])}
                        >
                            <i className="fas fa-play" />
                        </Button>
                        <Button
                            title="Next line"
                            onClick={(): void => props.onNext(props.process.threads[0])}
                        >
                            N
                        </Button>
                        <Button
                            title="Step into function"
                            onClick={(): void => props.onStepIn(props.process.threads[0])}
                        >
                            SI
                        </Button>
                    </>
                )}
                {props.process.threads.length && props.process.threads[0].status === 'running' && (
                    <div className="small-loading-spinner" />
                )}
            </div>
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
    onProceed: (thread: Thread) => void;
    onNext: (thread: Thread) => void;
    onStepIn: (thread: Thread) => void;
};

const ProcessesListing:
    React.FunctionComponent<ProcessesListingProps> = (props: ProcessesListingProps) => (
        <div className="processes-listing">
            {props.processes.map((proc, i) => (
                <Process
                    key={proc.pid}
                    index={i}
                    process={proc}
                    onProceed={props.onProceed}
                    onNext={props.onNext}
                    onStepIn={props.onStepIn}
                />
            ))}
        </div>
    );

export default ProcessesListing;

import * as React from 'react';

import Mutex from './Mutex';
import Semaphore from './Semaphore';
import ConditionVariable from './ConditionVariable';
import { Process } from '../../common/communication';
import Pill from './Pill';

type ThreadPillProps = {
    pid: number;
    processColor: string;
    tid: number;
    threadColor: string;
}
export function ThreadPill(
    props: ThreadPillProps,
): React.ReactElement {
    return (
        <Pill text={props.pid.toString()} color={props.processColor}>
            <Pill text={`thread ${props.tid}`} color={props.threadColor} />
        </Pill>
    );
}

type ThreadsListingProps = {
    processes: Process[];
    pidColorMap?: {[pid: number]: string};
    tidColorMap?: {[tid: number]: string};
};

type ThreadsListingState = {
    selectedProcess: Process | null;
};

class ThreadsListing extends React.PureComponent<ThreadsListingProps, ThreadsListingState> {
    constructor(props: ThreadsListingProps) {
        super(props);
        this.state = {
            selectedProcess: props.processes[0] || null,
        };
    }

    componentDidUpdate(prevProps: ThreadsListingProps): void {
        if (prevProps.processes !== this.props.processes) {
            if (this.state.selectedProcess === null) {
                // eslint-disable-next-line react/no-did-update-set-state
                this.setState({
                    selectedProcess: this.props.processes[0] || null,
                });
            } else {
                // eslint-disable-next-line react/no-did-update-set-state
                this.setState({
                    selectedProcess: this.props.processes.find(
                        (proc) => proc.pid === this.state.selectedProcess.pid,
                    ) || null,
                });
            }
        }
    }

    setSelectedProcess = (e: React.ChangeEvent<HTMLSelectElement>): void => {
        this.setState({
            selectedProcess: this.props.processes.find(
                (proc) => proc.pid.toString() === e.currentTarget.value,
            ),
        });
    };

    render(): React.ReactNode {
        return (
            <div className="threads-listing">
                <div className="process-selection">
                    Select a process:
                    <select
                        value={(this.state.selectedProcess && this.state.selectedProcess.pid)
                            || undefined}
                        onChange={this.setSelectedProcess}
                    >
                        { this.props.processes.map((proc) => (
                            <option className="inline" key={proc.pid} value={proc.pid}>PID {proc.pid}</option>)) }
                    </select>
                </div>
                {(this.state.selectedProcess && this.state.selectedProcess.mutexes.length && (
                    <>
                        <h2>Mutexes</h2>
                        <div className="mutexes">
                            {this.state.selectedProcess.mutexes.map((mtx) => (
                                <Mutex
                                    key={mtx.address}
                                    mutex={mtx}
                                    pid={this.state.selectedProcess.pid}
                                    processColor={
                                        this.props.pidColorMap[this.state.selectedProcess.pid]
                                    }
                                    tidColorMap={this.props.tidColorMap}
                                />
                            ))}
                        </div>
                    </>
                )) || null}
                {(this.state.selectedProcess && this.state.selectedProcess.semaphores.length && (
                    <>
                        <h2>Semaphores</h2>
                        <div className="mutexes">
                            {this.state.selectedProcess.semaphores.map(
                                (sem) => <Semaphore key={sem.address} semaphore={sem} />,
                            )}
                        </div>
                    </>
                )) || null}
                {(this.state.selectedProcess
                    && this.state.selectedProcess.conditionVariables.length && (
                    <>
                        <h2>Condition Variables</h2>
                        <div className="mutexes">
                            {this.state.selectedProcess
                                && this.state.selectedProcess.conditionVariables.map(
                                    (cv) => <ConditionVariable key={cv.address} cv={cv} />,
                                )}
                        </div>
                    </>
                )) || null}
            </div>
        );
    }
}

export default ThreadsListing;

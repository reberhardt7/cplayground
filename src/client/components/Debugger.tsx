import * as React from 'react';
import classNames from 'classnames';

import Diagram from './Diagram';
import ProcessesListing from './ProcessesListing';
import * as Server from '../server-comm';
import { ContainerInfo, Thread } from '../../common/communication';
import { filterKeypress } from '../accessibility-utils';

export const PROCESS_COLORS = ['#7aa843', '#85628f', '#a63939', '#6297c9'];

enum Tab {
    Processes,
    OpenFiles,
}

type DebuggerProps = {
    socket?: SocketIOClient.Socket;
}

type DebuggerState = {
    activeTab: Tab;
    data: ContainerInfo | null;
}

class Debugger extends React.Component<DebuggerProps, DebuggerState> {
    // Opaque object containing functions that were bound to the socket as event listeners.
    // We just need to remember these so that we can unbind the functions if this component
    // unmounts.
    boundSocketListeners?: Server.BoundSocketListeners;

    constructor(props: DebuggerProps) {
        super(props);
        this.state = {
            activeTab: Tab.Processes,
            data: null,
        };
    }

    componentDidMount(): void {
        if (this.props.socket) {
            this.bindToSocket(this.props.socket);
        }
    }

    componentDidUpdate(prevProps: Readonly<DebuggerProps>): void {
        if (this.props.socket === prevProps.socket) {
            return;
        }

        // Handle changes in socket
        if (prevProps.socket) {
            this.detachFromSocket(prevProps.socket);
        }
        if (this.props.socket) {
            // eslint-disable-next-line react/no-did-update-set-state
            this.setState({ data: null });
            this.bindToSocket(this.props.socket);
        }
    }

    componentWillUnmount(): void {
        if (this.props.socket) {
            this.detachFromSocket(this.props.socket);
        }
    }

    bindToSocket = (socket: SocketIOClient.Socket): void => {
        this.boundSocketListeners = Server.bindSocketToDebugger(socket,
            (data: ContainerInfo) => this.setState({ data }));
    };

    detachFromSocket = (socket: SocketIOClient.Socket): void => {
        Server.releaseSocketFromDebugger(socket, this.boundSocketListeners);
        this.boundSocketListeners = null;
    };

    renderTab = (title: string, tab: Tab): React.ReactNode => {
        const onClick = (): void => this.setState({ activeTab: tab });
        return (
            <div
                className={classNames('debugger-tab', { active: this.state.activeTab === tab })}
                onClick={onClick}
                onKeyDown={(e): void => filterKeypress(e, onClick)}
                role="button"
                tabIndex={0}
            >
                {title}
            </div>
        );
    };

    onProceed = (thread: Thread): void => {
        Server.proceed(this.props.socket, thread);
    };

    onNext = (thread: Thread): void => {
        Server.next(this.props.socket, thread);
    };

    onStepIn = (thread: Thread): void => {
        Server.stepIn(this.props.socket, thread);
    };

    render(): React.ReactNode {
        return (
            <div className="debugger">
                <div className="debugger-tabbar">
                    {this.renderTab('Processes', Tab.Processes)}
                    {this.renderTab('Open Files', Tab.OpenFiles)}
                </div>
                <div className="debugger-body">
                    {this.state.activeTab === Tab.Processes && (
                        <ProcessesListing
                            processes={(this.state.data && this.state.data.processes)
                                || []}
                            onProceed={this.onProceed}
                            onNext={this.onNext}
                            onStepIn={this.onStepIn}
                        />
                    )}
                    {this.state.activeTab === Tab.OpenFiles
                        && <Diagram data={this.state.data} />}
                </div>
            </div>
        );
    }
}

export default Debugger;

import * as React from 'react';
import classNames from 'classnames';
import Url from 'url-parse';

import OpenFilesDiagram from './OpenFilesDiagram';
import ProcessesListing from './ProcessesListing';
import ThreadsListing from './ThreadsListing';
import { DebugServer } from '../server-comm';
import { ContainerInfo } from '../../common/communication';
import { filterKeypress } from '../accessibility-utils';
import SignalsTab from './SignalsTab';

enum Tab {
    Processes = 'processes',
    OpenFiles = 'open-files',
    Signals = 'signals',
    Threads = 'threads',
}

type DebuggerProps = {
    debugServer?: DebugServer;
    debugData?: ContainerInfo;
    pidColorMap?: {[pid: number]: string};
    tidColorMap?: {[tid: number]: string};
}

type DebuggerState = {
    activeTab: Tab;
}

class Debugger extends React.PureComponent<DebuggerProps, DebuggerState> {
    constructor(props: DebuggerProps) {
        super(props);
        this.state = {
            activeTab: Tab.Processes,
        };
    }

    componentDidMount(): void {
        const currentLocation = Url(window.location.href, window.location, true);
        const defaultTab = currentLocation.query.defaultDebugTab as unknown;
        if (Object.values(Tab as unknown as unknown[]).includes(defaultTab)) {
            this.setState({
                activeTab: defaultTab as Tab,
            });
        }
    }

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

    render(): React.ReactNode {
        return (
            <div className="debugger">
                <div className="debugger-tabbar">
                    {this.renderTab('Processes', Tab.Processes)}
                    {this.renderTab('Open Files', Tab.OpenFiles)}
                    {this.renderTab('Signals', Tab.Signals)}
                    {this.renderTab('Threads', Tab.Threads)}
                </div>
                <div className="debugger-body">
                    {this.state.activeTab === Tab.Processes && (
                        <ProcessesListing
                            processes={(this.props.debugData && this.props.debugData.processes)
                                || []}
                            debugServer={this.props.debugServer}
                            pidColorMap={this.props.pidColorMap}
                        />
                    )}
                    {this.state.activeTab === Tab.OpenFiles && (
                        <OpenFilesDiagram
                            data={this.props.debugData}
                            pidColorMap={this.props.pidColorMap}
                        />
                    )}
                    {this.state.activeTab === Tab.Signals && (
                        <SignalsTab
                            processes={(this.props.debugData && this.props.debugData.processes)
                                || []}
                            debugServer={this.props.debugServer}
                            pidColorMap={this.props.pidColorMap}
                        />
                    )}
                    {this.state.activeTab === Tab.Threads && (
                        <ThreadsListing
                            processes={(this.props.debugData && this.props.debugData.processes)
                                || []}
                            pidColorMap={this.props.pidColorMap}
                            tidColorMap={this.props.tidColorMap}
                        />
                    )}
                </div>
            </div>
        );
    }
}

export default Debugger;

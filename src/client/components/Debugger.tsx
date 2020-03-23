import * as React from 'react';
import classNames from 'classnames';

import Diagram from './Diagram';
import ProcessesListing from './ProcessesListing';
import { DebugServer } from '../server-comm';
import { ContainerInfo } from '../../common/communication';
import { filterKeypress } from '../accessibility-utils';

enum Tab {
    Processes,
    OpenFiles,
}

type DebuggerProps = {
    debugServer?: DebugServer;
    debugData?: ContainerInfo;
    pidColorMap?: {[pid: number]: string};
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
                        <Diagram
                            data={this.props.debugData}
                            pidColorMap={this.props.pidColorMap}
                        />
                    )}
                </div>
            </div>
        );
    }
}

export default Debugger;

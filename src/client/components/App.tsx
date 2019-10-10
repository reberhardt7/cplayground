import * as React from 'react';
import classNames from 'classnames';

import Topbar from './Topbar';
import Sidebar from './Sidebar';
import Editor from './Editor';
import Terminal from './Terminal';

// Layouts for embedded mode (where split pane doesn't look so good)
export enum Layout {
    EDIT,
    SPLIT,
    RUN,
}

type AppProps = {
    inEmbeddedMode: boolean;
};

type AppState = {
    showSettingsPane: boolean;
};

class App extends React.PureComponent<AppProps, AppState> {
    constructor(props: AppProps) {
        super(props);
        this.state = {
            showSettingsPane: false,
        };
    }

    toggleSettingsPane = (): void => {
        this.setState({ showSettingsPane: !this.state.showSettingsPane });
    };

    runProgram = (): void => {
        // TODO
    };

    setLayout = (layout: Layout): void => {
        // TODO
    }

    render(): React.ReactNode {
        return (
            <>
                <Topbar
                    inEmbeddedMode={this.props.inEmbeddedMode}
                    onSettingsBtnClick={this.toggleSettingsPane}
                    onRunBtnClick={this.runProgram}
                    onEditBtnClick={(): void => this.setLayout(Layout.EDIT)}
                    onSplitBtnClick={(): void => this.setLayout(Layout.SPLIT)}
                />
                <div
                    className={
                        classNames('primary-container',
                            { 'open-sidebar': this.state.showSettingsPane })
                    }
                >
                    <Sidebar />
                    <Editor />
                    <Terminal />
                </div>
            </>
        );
    }
}

export default App;

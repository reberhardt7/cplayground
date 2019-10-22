import * as React from 'react';
import classNames from 'classnames';
import * as Url from 'url-parse';

import Topbar from './Topbar';
import Sidebar from './Sidebar';
import Editor from './Editor';
import Terminal from './Terminal';

import {
    Program,
    getProgram,
    SUPPORTED_VERSIONS,
} from '../server-comm';

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
    program?: Program;
};

class App extends React.PureComponent<AppProps, AppState> {
    constructor(props: AppProps) {
        super(props);
        this.state = {
            showSettingsPane: false,
        };
    }

    componentDidMount(): void {
        const currentLocation = Url(window.location.href);
        const programId = currentLocation.query.p;
        getProgram(programId).then((program: Program) => {
            this.setState({ program });
        });
    }

    toggleSettingsPane = (): void => {
        this.setState({ showSettingsPane: !this.state.showSettingsPane });
    };

    runProgram = (): void => {
        // TODO
    };

    setLayout = (layout: Layout): void => {
        // TODO
    };

    setLanguage = (language: typeof SUPPORTED_VERSIONS[number]): void => {
        this.setState({
            program: {
                ...this.state.program,
                language,
            },
        });
    };

    setCFlags = (flags: Set<string>): void => {
        this.setState({
            program: {
                ...this.state.program,
                flags,
            },
        });
    };

    setRuntimeArgs = (runtimeArgs: string): void => {
        this.setState({
            program: {
                ...this.state.program,
                runtimeArgs,
            },
        });
    };

    setCode = (code: string): void => {
        this.setState({
            program: {
                ...this.state.program,
                code,
            },
        });
    };

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
                    {this.state.program && (
                        <Sidebar
                            selectedVersion={this.state.program.language}
                            selectedFlags={new Set(this.state.program.flags)}
                            runtimeArgs={this.state.program.runtimeArgs}
                            onVersionChange={this.setLanguage}
                            onFlagsChange={this.setCFlags}
                            onRuntimeArgsChange={this.setRuntimeArgs}
                        />
                    )}
                    <Editor
                        code={this.state.program && this.state.program.code}
                        onCodeChange={this.setCode}
                        toggleSettingsPane={this.toggleSettingsPane}
                    />
                    <Terminal />
                </div>
            </>
        );
    }
}

export default App;

import * as React from 'react';
import classNames from 'classnames';
import * as Url from 'url-parse';

import Topbar from './Topbar';
import Sidebar from './Sidebar';
import Editor from './Editor';
import Terminal from './Terminal';

import * as Server from '../server-comm';

import Program = Server.Program;

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
    terminalSize: { rows: number; cols: number };
    programRunning: boolean;
    socket?: SocketIOClient.Socket;
};

class App extends React.PureComponent<AppProps, AppState> {
    constructor(props: AppProps) {
        super(props);
        this.state = {
            showSettingsPane: false,
            // Arbitrary size (this gets changed as soon as Terminal mounts)
            terminalSize: { rows: 80, cols: 24 },
            programRunning: false,
        };
    }

    componentDidMount(): void {
        // Load program for current URL
        const currentLocation = Url(window.location.href, window.location, true);
        const programId = currentLocation.query.p;
        Server.getProgram(programId).then((program: Program) => {
            this.setState({ program });
        });

        // Add keyboard listeners
        document.onkeydown = this.handleKeyboardEvent;
    }

    handleKeyboardEvent = (e: KeyboardEvent): boolean => {
        // Execute code on shift+enter
        if (e.keyCode === 13 && e.shiftKey) {
            this.runProgram();
            return false;
        }
        // Open settings on cmd/ctrl+comma
        const isMac = ['Macintosh', 'MacIntel'].indexOf(window.navigator.platform) > -1;
        if ((isMac && e.metaKey && e.keyCode === 188)
            || (!isMac && e.ctrlKey && e.keyCode === 188)) {
            this.toggleSettingsPane();
            return false;
        }
        // TODO: add back for embedded mode
        // // Open editor pane on cmd/ctrl+e
        // if ((isMac && e.metaKey && e.keyCode === 69)
        //     || (!isMac && e.ctrlKey && e.keyCode === 69)) {
        //     showEditorPane();
        //     return false;
        // }

        return true;
    };

    toggleSettingsPane = (): void => {
        this.setState({ showSettingsPane: !this.state.showSettingsPane });
    };

    runProgram = (): void => {
        const sock = Server.makeDockerSocket(
            this.state.terminalSize.rows,
            this.state.terminalSize.cols,
        );
        Server.startProgram(sock, this.state.program)
            .then((): void => {
                this.setState({
                    programRunning: false,
                    socket: null,
                });
            });
        this.setState({
            programRunning: true,
            socket: sock,
        });
    };

    setLayout = (layout: Layout): void => {
        // TODO
    };

    setLanguage = (language: typeof Server.SUPPORTED_VERSIONS[number]): void => {
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

    setTerminalSize = (rows: number, cols: number): void => {
        this.setState({
            terminalSize: { rows, cols },
        });
    };

    render(): React.ReactNode {
        return (
            <>
                <Topbar
                    inEmbeddedMode={this.props.inEmbeddedMode}
                    isProgramRunning={this.state.programRunning}
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
                        settingsPaneIsOpen={this.state.showSettingsPane}
                    />
                    <Terminal
                        onResize={this.setTerminalSize}
                        socket={this.state.socket}
                    />
                </div>
            </>
        );
    }
}

export default App;

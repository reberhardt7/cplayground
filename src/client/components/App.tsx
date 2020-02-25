import * as React from 'react';
import classNames from 'classnames';
import Url from 'url-parse';

import Topbar from './Topbar';
import Sidebar from './Sidebar';
import Editor from './Editor';
import Terminal from './Terminal';

import { SavedProgram } from '../../common/communication';
import { CompilerFlag, SupportedVersion } from '../../common/constants';
import * as Server from '../server-comm';

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
    layout: Layout;
    showSettingsPane: boolean;
    program?: SavedProgram;
    terminalSize: { rows: number; cols: number };
    programRunning: boolean;
    socket?: SocketIOClient.Socket;
    breakpoints: number[];
};

class App extends React.PureComponent<AppProps, AppState> {
    constructor(props: AppProps) {
        super(props);
        this.state = {
            layout: props.inEmbeddedMode ? Layout.EDIT : Layout.SPLIT,
            showSettingsPane: false,
            // Arbitrary size (this gets changed as soon as Terminal mounts)
            terminalSize: { rows: 80, cols: 24 },
            programRunning: false,
            breakpoints: [],
        };
    }

    componentDidMount(): void {
        // Load program for current URL
        const currentLocation = Url(window.location.href, window.location, true);
        const programId = currentLocation.query.p;
        Server.getProgram(programId).then((program: SavedProgram) => {
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

        // For embedded mode, open editor pane on cmd/ctrl+e
        if (this.props.inEmbeddedMode && (
            (isMac && e.metaKey && e.keyCode === 69) || (!isMac && e.ctrlKey && e.keyCode === 69)
        )) {
            this.setLayout(Layout.EDIT);
            return false;
        }

        return true;
    };

    toggleSettingsPane = (): void => {
        this.setState({ showSettingsPane: !this.state.showSettingsPane });
    };

    onBreakpointChange = (breakpoints: number[]): void => {
        this.setState({ breakpoints });
    };

    /**
     * Opens the current program in a new tab in non-embedded mode.
     */
    openInCplayground = (): void => {
        const currentLocation = Url(window.location.href, window.location, true);
        window.open(currentLocation.set('pathname', '/').toString(), '_blank');
    };

    runProgram = (): void => {
        // If we are in embedded mode, go into terminal-only view
        if (this.props.inEmbeddedMode) {
            this.setLayout(Layout.RUN);
        }

        // Run the program
        const sock = Server.makeDockerSocket();
        Server.startProgram(
            sock, this.state.program, this.state.terminalSize.rows, this.state.terminalSize.cols,
        ).then((): void => {
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
        this.setState({ layout });
    };

    setLanguage = (language: SupportedVersion): void => {
        this.setState({
            program: {
                ...this.state.program,
                language,
            },
        });
    };

    setCFlags = (flags: CompilerFlag[]): void => {
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

    setIncludeFile = (file: {id: string; name: string} | null): void => {
        this.setState({
            program: {
                ...this.state.program,
                includeFileId: file && file.id,
                includeFileName: file && file.name,
            },
        });
    };

    render(): React.ReactNode {
        return (
            <>
                <Topbar
                    inEmbeddedMode={this.props.inEmbeddedMode}
                    currentLayout={this.state.layout}
                    isProgramRunning={this.state.programRunning}
                    onSettingsBtnClick={this.toggleSettingsPane}
                    onRunBtnClick={this.runProgram}
                    onEditBtnClick={(): void => this.setLayout(Layout.EDIT)}
                    onSplitBtnClick={(): void => this.setLayout(Layout.SPLIT)}
                    onOpenInCplayground={this.openInCplayground}
                />
                <div
                    className={
                        classNames('primary-container', {
                            'open-sidebar': this.state.showSettingsPane,
                            embedded: this.props.inEmbeddedMode,
                            'show-code-only': this.state.layout === Layout.EDIT,
                            'show-term-only': this.state.layout === Layout.RUN,
                        })
                    }
                >
                    {this.state.program && (
                        <Sidebar
                            selectedVersion={this.state.program.language}
                            selectedFlags={this.state.program.flags}
                            runtimeArgs={this.state.program.runtimeArgs}
                            includeFileName={this.state.program.includeFileName}
                            onVersionChange={this.setLanguage}
                            onFlagsChange={this.setCFlags}
                            onRuntimeArgsChange={this.setRuntimeArgs}
                            onIncludeFileChange={this.setIncludeFile}
                        />
                    )}
                    <Editor
                        inEmbeddedMode={this.props.inEmbeddedMode}
                        code={this.state.program && this.state.program.code}
                        onCodeChange={this.setCode}
                        toggleSettingsPane={this.toggleSettingsPane}
                        settingsPaneIsOpen={this.state.showSettingsPane}
                        breakpoints={this.state.breakpoints}
                        onBreakpointChange={this.onBreakpointChange}
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

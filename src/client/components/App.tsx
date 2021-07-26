import * as React from 'react';
import classNames from 'classnames';
import Url from 'url-parse';
import isEqual from 'react-fast-compare';

import Topbar from './Topbar';
import Sidebar from './Sidebar';
import Editor from './Editor';
import ProgramPane from './ProgramPane';

import { ContainerInfo, SavedProgram } from '../../common/communication';
import { CompilerFlag, SupportedVersion } from '../../common/constants';
import * as Server from '../server-comm';

// Layouts for embedded mode (where split pane doesn't look so good)
export enum Layout {
    EDIT,
    SPLIT,
    RUN,
}

// Colors used in debugger to indicate different processes
export const PROCESS_COLORS = ['#7aa843', '#85628f', '#a63939', '#6297c9'];

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
    debugServer?: Server.DebugServer;
    debugData?: ContainerInfo;
    breakpoints: number[];
};

class App extends React.PureComponent<AppProps, AppState> {
    constructor(props: AppProps) {
        super(props);
        this.state = {
            layout: props.inEmbeddedMode ? Layout.EDIT : Layout.SPLIT,
            showSettingsPane: false,
            // Arbitrary size (this gets changed as soon as Terminal mounts)
            terminalSize: { rows: 24, cols: 80 },
            programRunning: false,
            breakpoints: [],
        };
    }

    componentDidMount(): void {
        // Load program for current URL
        const currentLocation = Url(window.location.href, window.location, true);
        const programId = currentLocation.query.p;
        Server.getProgram(programId).then((program: SavedProgram) => {
            const breakpoints = currentLocation.query.breakpoints
                && JSON.parse(currentLocation.query.breakpoints);
            this.setState({
                program,
                breakpoints: Array.isArray(breakpoints) ? breakpoints : [],
            });
        });

        // Add keyboard listeners
        document.onkeydown = this.handleKeyboardEvent;
    }

    componentDidUpdate(prevProps: AppProps, prevState: AppState): void {
        if (prevState.breakpoints !== this.state.breakpoints) {
            // Update breakpoints in URL:
            const currentLocation = Url(window.location.href, window.location, true);
            if (this.state.breakpoints.length) {
                currentLocation.query.breakpoints = JSON.stringify(this.state.breakpoints);
            } else if (currentLocation.query.breakpoints !== undefined) {
                delete currentLocation.query.breakpoints;
            }
            window.history.replaceState(null, null, currentLocation.toString());

            if (this.state.programRunning) {
                // User changed breakpoints while program is running. We need to inform the server
                // of the change.
                const oldBreakpoints = new Set(prevState.breakpoints);
                const newBreakpoints = new Set(this.state.breakpoints);
                // Added breakpoints:
                this.state.breakpoints
                    .filter((line) => !oldBreakpoints.has(line))
                    .forEach((line) => { this.state.debugServer.setBreakpoint(line); });
                // Removed breakpoints:
                prevState.breakpoints
                    .filter((line) => !newBreakpoints.has(line))
                    .forEach((line) => { this.state.debugServer.removeBreakpoint(line); });
            }
        }
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
            this.state.breakpoints.length > 0, this.state.breakpoints,
        ).then((): void => {
            this.setState({
                programRunning: false,
                socket: null,
                debugServer: null,
            });
        });
        this.setState({
            programRunning: true,
            socket: sock,
            debugServer: new Server.DebugServer(sock, (debugData) => {
                // Only update stored data if the data has actually changed. (We get new data
                // every second, and it's a different object even if the contents are the same.
                // If we setState unconditionally, we'll be rerendering every second.)
                if (!isEqual(this.state.debugData, debugData)) {
                    this.setState({ debugData });
                }
            }),
            debugData: null,
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

    generatePidColorMap = (): {[pid: number]: string} => {
        const colorMap: {[pid: number]: string} = {};
        if (this.state.debugData) {
            this.state.debugData.processes.forEach((proc, i) => {
                colorMap[proc.pid] = PROCESS_COLORS[i % PROCESS_COLORS.length];
            });
        }
        return colorMap;
    };

    generateTidColorMap = (pidColorMap: {[pid: number]: string}): {[tid: number]: string} => {
        const colorMap: {[tid: number]: string} = {};
        if (this.state.debugData) {
            this.state.debugData.processes.forEach((proc) => {
                const colors = PROCESS_COLORS.filter((color) => color !== pidColorMap[proc.pid]);
                proc.threads.forEach((thread) => {
                    colorMap[thread.debuggerId] = (
                        colors[thread.debuggerId % colors.length]
                    );
                });
            });
        }
        return colorMap;
    };

    render(): React.ReactNode {
        const pidColorMap = this.generatePidColorMap();
        return (
            <>
                <Topbar
                    inEmbeddedMode={this.props.inEmbeddedMode}
                    currentLayout={this.state.layout}
                    isProgramRunning={this.state.programRunning}
                    debug={this.state.breakpoints.length > 0}
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
                        processes={this.state.debugData && this.state.debugData.processes}
                        pidColorMap={pidColorMap}
                        tidColorMap={this.generateTidColorMap(pidColorMap)}
                        debugServer={this.state.debugServer}
                    />
                    <ProgramPane
                        onResize={this.setTerminalSize}
                        socket={this.state.socket}
                        debug={(this.state.programRunning && this.state.breakpoints.length > 0)
                            || Boolean(this.state.debugData)}
                        debugServer={this.state.debugServer}
                        debugData={this.state.debugData}
                        pidColorMap={pidColorMap}
                        tidColorMap={this.generateTidColorMap(pidColorMap)}
                    />
                </div>
            </>
        );
    }
}

export default App;

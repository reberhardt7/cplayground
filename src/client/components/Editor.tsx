import * as React from 'react';
import AceEditor from 'react-ace';
import { Ace } from 'ace-builds';

import { Process } from '../../common/communication';
import { DebugServer } from '../server-comm';
import { generateInlineDebugControlNode } from './InlineDebugControls';

// Scroll margin applied to editor if we are in embedded mode. This is because the editor margins
// are removed in embedded mode (since there isn't as much real estate, and only one pane is showing
// so the side padding is unnecessary), but we still want some vertical spacing. We could remove
// only the horizontal margin and keep the vertical, but it looks bad because that also adds
// vertical spacing around the scroll bar so the top of the scroll bar is not flush with the topbar.
const EMBEDDED_PADDING = [8, 8, 0, 0];

type EditorProps = {
    // Used to add EMBEDDED_PADDING to editor if we are in embedded mode
    inEmbeddedMode: boolean;
    toggleSettingsPane: () => void;
    settingsPaneIsOpen: boolean;
    onCodeChange: (code: string) => void;
    code: string;
    breakpoints: number[];
    onBreakpointChange: (breakpoints: number[]) => void;
    processes: Process[] | null;
    pidColorMap: {[pid: number]: string};
    tidColorMap: {[tid: number]: string};
    debugServer: DebugServer;
};

type AceMouseEvent = {
    domEvent: MouseEvent;
    editor: AceEditor;
    clientX: number;
    clientY: number;
    getDocumentPosition: () => { row: number; column: number };
};

type AceChangeEvent = {
    start: Ace.Point;
    end: Ace.Point;
    action: 'insert' | 'remove';
    lines: string[];
};

class Editor extends React.Component<EditorProps> {
    aceComponent: React.RefObject<AceEditor>;
    debugControlWidgets: {[line: number]: HTMLDivElement[] };

    constructor(props: EditorProps) {
        super(props);
        this.aceComponent = React.createRef();
    }

    componentDidMount(): void {
        const { editor } = this.aceComponent.current;

        // Set breakpoints on mount
        for (let i = 0; i < this.props.breakpoints.length; i += 1) {
            editor.session.setBreakpoint(this.props.breakpoints[i]);
        }
        editor.addEventListener('gutterclick', this.toggleBreakpoint);
        editor.renderer.on('afterRender', this.renderDebuggerControls);
    }

    componentDidUpdate(prevProps: Readonly<EditorProps>): void {
        const { editor } = this.aceComponent.current;

        // Clear breakpoints then set new ones
        for (let i = 0; i < prevProps.breakpoints.length; i += 1) {
            editor.session.clearBreakpoint(prevProps.breakpoints[i] - 1);
        }
        // Set breakpoints on update
        for (let i = 0; i < this.props.breakpoints.length; i += 1) {
            editor.session.setBreakpoint(this.props.breakpoints[i] - 1);
        }

        // Manually resize ACE editor after CSS transition has completed
        if (this.props.settingsPaneIsOpen !== prevProps.settingsPaneIsOpen) {
            setTimeout(() => editor.resize(), 400);
        }

        // Update inline controls for stopped threads
        if (this.props.processes !== prevProps.processes) {
            this.regenerateDebugControlWidgets();
        }
    }

    componentWillUnmount(): void {
        const { editor } = this.aceComponent.current;
        editor.removeEventListener('gutterclick', this.toggleBreakpoint);
    }

    regenerateDebugControlWidgets = (): void => {
        // Remove old nodes from the DOM
        if (this.debugControlWidgets) {
            Object.values(this.debugControlWidgets).forEach((widgets) => {
                widgets.forEach((widget) => {
                    if (widget.parentElement) {
                        widget.parentElement.removeChild(widget);
                    }
                });
            });
        }
        this.debugControlWidgets = {};

        // Generate new nodes
        if (!this.props.processes) {
            return;
        }
        const threadsWithFrameInfo = this.props.processes.map((process) => (
            process.threads
            // Only show threads that are stopped somewhere we can render
                .filter((thread) => thread.currentLine)
                .map((thread) => ({ process, thread }))
        )).flat();
        threadsWithFrameInfo.forEach((thread) => {
            if (this.debugControlWidgets[thread.thread.currentLine] === undefined) {
                this.debugControlWidgets[thread.thread.currentLine] = [];
            }
            this.debugControlWidgets[thread.thread.currentLine].push(
                generateInlineDebugControlNode(
                    thread.process, this.props.pidColorMap[thread.process.pid],
                    thread.thread, this.props.tidColorMap[thread.thread.debuggerId],
                    this.props.debugServer,
                ),
            );
        });
    };

    onChange = (code: string, e: AceChangeEvent): void => {
        this.props.onCodeChange(code);
        this.updateBreakpointsForCodeChange(e);
    };

    toggleBreakpoint = (e: AceMouseEvent): void => {
        const { editor } = this.aceComponent.current;
        // 0-indexed
        const { row } = e.getDocumentPosition();
        const target = e.domEvent.target as Element;
        const breakpoints = editor.session.getBreakpoints();

        if (!target.classList.contains('ace_gutter-cell')) {
            return;
        }

        // If there's a breakpoint already defined, it should be removed
        if (breakpoints[row] === undefined) {
            editor.session.setBreakpoint(row);
            // When adding breakpoint to breakpoints prop, 1-index
            this.props.onBreakpointChange([...this.props.breakpoints, row + 1]);
        } else {
            editor.session.clearBreakpoint(row);
            this.props.onBreakpointChange(
                // When adding breakpoint to breakpoints prop, 1-index
                this.props.breakpoints.filter((r: number) => r !== row + 1),
            );
        }
    };

    updateBreakpointsForCodeChange = (e: AceChangeEvent): void => {
        // Rows are 0-indexed, so add 1 to get line numbers.
        const startLine = e.start.row + 1;
        // e.lines includes all lines that were modified. If its length is 1, no lines were
        // added or removed, but if it's greater than 1, then the number of lines added/removed
        // is e.lines.length - 1
        const lineCountDiff = (e.lines.length - 1) * (e.action === 'insert' ? 1 : -1);
        if (lineCountDiff !== 0) {
            // Shift breakpoints over: remove breakpoints that are past where the modification
            // happened, then add them back, shifted over by lineCountDiff
            const newBreakpoints = this.props.breakpoints.filter((line) => line <= startLine);
            this.props.breakpoints.filter((line) => line > startLine).forEach((line) => {
                // lineCountDiff can be negative. Make sure we don't end up with an invalid
                // breakpoint
                if (line + lineCountDiff >= 1) {
                    newBreakpoints.push(line + lineCountDiff);
                }
            });
            this.props.onBreakpointChange(newBreakpoints);
        }
    };

    /**
     * This function hooks into the Ace rendering internals to add elements at the end of lines
     * displaying debugger controls. (If the debugger is paused at a certain line, this function
     * will render controls at the end of that line.) Since this deals with Ace internals, the
     * type annotations are shit. Sorry :(
     *
     * Adapted from: https://groups.google.com/forum/#!topic/ace-discuss/2dYYGcR_NyI
     * http://plnkr.co/edit/fGqwUnaVndzVavi5JCu3?p=preview&preview
     *
     * I also considered using Ace's dynamic marker API instead of doing this, but it seems more
     * oriented around highlighting lines and less around inserting interactive
     * buttons/controls. Also, the documentation is TERRIBLE. I couldn't figure out how to do
     * anything relevant.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    renderDebuggerControls = (changes: number, renderer: any): void => {
        if (!this.debugControlWidgets || !Object.keys(this.debugControlWidgets).length) {
            // There's nothing to render
            return;
        }

        const textLayer = renderer.$textLayer;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { config, session } = textLayer as { session: Ace.EditSession; config: any };

        const lineElements = textLayer.element.childNodes;
        for (let row = config.firstRow; row <= config.lastRow; row += 1) {
            const foldLine = session.getNextFoldLine(row);
            // If we're inside a fold (i.e. collapsed block), jump to the end of the fold and
            // skip past it. (We can't render anything inside the fold.)
            if (foldLine && row > foldLine.start.row) {
                row = foldLine.end.row;
                continue;
            }
            const line = row + 1; // Line numbers are 1-indexed
            const lineElement = lineElements[row - config.firstRow];
            const widgets = this.debugControlWidgets[line];
            if (lineElement && widgets) {
                widgets.forEach((widget) => {
                    if (widget.parentElement !== lineElement) {
                        lineElement.appendChild(widget);
                    }
                });
            }
        }
    };

    render(): React.ReactNode {
        return (
            <div className="code-container">
                <AceEditor
                    ref={this.aceComponent}
                    mode="c_cpp"
                    onChange={this.onChange}
                    value={this.props.code}
                    width="100%"
                    height="100%"
                    scrollMargin={this.props.inEmbeddedMode ? EMBEDDED_PADDING : undefined}
                    focus
                    commands={[{
                        name: 'showSidebar',
                        bindKey: { win: 'Ctrl-,', mac: 'Command-,' },
                        exec: this.props.toggleSettingsPane,
                    }]}
                />
            </div>
        );
    }
}

export default Editor;

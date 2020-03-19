import * as React from 'react';
import AceEditor from 'react-ace';
import { Ace } from 'ace-builds';

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

class Editor extends React.PureComponent<EditorProps> {
    aceComponent: React.RefObject<AceEditor>;

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
        if (this.props.settingsPaneIsOpen !== prevProps.settingsPaneIsOpen) {
            // Manually resize ACE editor after CSS transition has completed
            setTimeout(() => editor.resize(), 400);
        }
    }

    componentWillUnmount(): void {
        const { editor } = this.aceComponent.current;
        editor.removeEventListener('gutterclick', this.toggleBreakpoint);
    }

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
                newBreakpoints.push(line + lineCountDiff);
            });
            this.props.onBreakpointChange(newBreakpoints);
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

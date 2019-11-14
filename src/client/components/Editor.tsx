import * as React from 'react';
import AceEditor from 'react-ace';

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

class Editor extends React.PureComponent<EditorProps> {
    aceComponent: React.RefObject<AceEditor>;

    constructor(props: EditorProps) {
        super(props);
        this.aceComponent = React.createRef();
    }

    componentDidMount(): void {
        const { editor } = this.aceComponent.current;
        editor.on('gutterclick', (e: AceMouseEvent) => {
            // 0-indexed
            const { row } = e.getDocumentPosition();
            const target = e.domEvent.target as Element;
            const breakpoints = editor.session.getBreakpoints(row, 0);

            if (target.className.indexOf('ace_gutter-cell') === -1) {
                return;
            }

            if (!editor.isFocused()) {
                return;
            }

            // If there's a breakpoint already defined, it should be removed
            if (typeof breakpoints[row] === typeof undefined) {
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
        });
    }

    componentDidUpdate(prevProps: Readonly<EditorProps>): void {
        if (this.props.settingsPaneIsOpen !== prevProps.settingsPaneIsOpen) {
            // Manually resize ACE editor after CSS transition has completed
            setTimeout(() => this.aceComponent.current.editor.resize(), 400);
        }
    }

    render(): React.ReactNode {
        return (
            <div className="code-container">
                <AceEditor
                    ref={this.aceComponent}
                    mode="c_cpp"
                    onChange={this.props.onCodeChange}
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

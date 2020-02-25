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
};

class Editor extends React.PureComponent<EditorProps> {
    aceComponent: React.RefObject<AceEditor>;

    constructor(props: EditorProps) {
        super(props);
        this.aceComponent = React.createRef();
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

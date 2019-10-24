import * as React from 'react';
import AceEditor from 'react-ace';

type EditorProps = {
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

import * as React from 'react';
import AceEditor from 'react-ace';

type EditorProps = {
    toggleSettingsPane: () => void;
    onCodeChange: (code: string) => void;
    code: string;
};

class Editor extends React.PureComponent<EditorProps> {
    render(): React.ReactNode {
        return (
            <div className="code-container">
                <AceEditor
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

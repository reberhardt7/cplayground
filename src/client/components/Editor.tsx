import * as React from 'react';
import AceEditor from 'react-ace';

type EditorProps = {
    toggleSettingsPane: () => void;
};

type EditorState = {
    sourceCode: string;
};

class Editor extends React.PureComponent<EditorProps, EditorState> {
    constructor(props: EditorProps) {
        super(props);
        this.state = {
            sourceCode: '',
        };
    }

    onChange = (sourceCode: string): void => {
        this.setState({ sourceCode });
    }

    render(): React.ReactNode {
        return (
            <div className="code-container">
                <AceEditor
                    mode="c_cpp"
                    onChange={this.onChange}
                    value={this.state.sourceCode}
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

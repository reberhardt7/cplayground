import * as React from 'react';

class Editor extends React.PureComponent {
    render(): React.ReactNode {
        return (
            <div className="code-container">
                <div id="editor">{/* {INITIAL_CODE} */}</div>
            </div>
        );
    }
}

export default Editor;

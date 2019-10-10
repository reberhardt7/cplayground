import * as React from 'react';

type TopbarProps = {
    inEmbeddedMode: boolean;
    onSettingsBtnClick: () => void;
    onRunBtnClick: () => void;
    onEditBtnClick: () => void;
    onSplitBtnClick: () => void;
};

class Topbar extends React.PureComponent<TopbarProps> {
    render(): React.ReactNode {
        const embeddedModeButtons = (
            <>
                <div
                    role="button"
                    className="btn has-shortcut"
                    id="edit-btn"
                    onClick={this.props.onEditBtnClick}
                    onKeyDown={this.props.onEditBtnClick}
                    tabIndex={0}
                >
                    <div className="main-text">
                        <i className="fas fa-pencil-alt icon" />
                        &nbsp;Edit
                    </div>
                    <div className="shortcut">cmd+e</div>
                </div>
                <div
                    role="button"
                    className="btn"
                    id="split-pane-btn"
                    onClick={this.props.onSplitBtnClick}
                    onKeyDown={this.props.onSplitBtnClick}
                    tabIndex={0}
                >
                    <div className="main-text">
                        <i className="fas fa-columns icon" />
                        &nbsp;Split
                    </div>
                </div>
            </>
        );
        return (
            <div className="topbar">
                <div
                    role="button"
                    className="btn has-shortcut"
                    id="settings-btn"
                    onClick={this.props.onSettingsBtnClick}
                    onKeyDown={this.props.onSettingsBtnClick}
                    tabIndex={0}
                >
                    <div className="main-text"><i className="fas fa-cog" /></div>
                    <div className="shortcut">cmd+,</div>
                </div>
                <div
                    role="button"
                    className="btn has-shortcut"
                    id="run-btn"
                    onClick={this.props.onRunBtnClick}
                    onKeyDown={this.props.onRunBtnClick}
                    tabIndex={0}
                >
                    <div className="main-text">
                        <div className="icon play-icon">
                            <span className="outline">&#9655;</span>
                            <span className="filled">&#9654;</span>
                        </div>
                        Run
                    </div>
                    <div className="shortcut">shift+enter</div>
                </div>
                {this.props.inEmbeddedMode ? embeddedModeButtons : null}
            </div>
        );
    }
}

export default Topbar;

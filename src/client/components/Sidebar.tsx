import * as React from 'react';

import {
    SUPPORTED_VERSIONS,
    OPTIMIZATION_LEVELS,
    COMPILER_FLAGS,
    LINKER_FLAGS, SupportedVersion, CompilerFlag, OptimizationLevel,
} from '../../common/constants';

type SidebarProps = {
    selectedVersion: SupportedVersion;
    selectedFlags: CompilerFlag[];
    runtimeArgs: string;
    onVersionChange: (version: SupportedVersion) => void;
    onFlagsChange: (flags: CompilerFlag[]) => void;
    onRuntimeArgsChange: (args: string) => void;
};

type LabeledCompilerFlags =
    ReadonlyArray<typeof COMPILER_FLAGS[number] | typeof LINKER_FLAGS[number]>;

class Sidebar extends React.PureComponent<SidebarProps> {
    setCompilerVersion = (e: React.ChangeEvent<HTMLSelectElement>): void => {
        this.props.onVersionChange(e.currentTarget.value as SupportedVersion);
    };

    setOptimizationLevel = (e: React.ChangeEvent<HTMLSelectElement>): void => {
        const flags = new Set(this.props.selectedFlags);
        // Clear out previous optimization level
        OPTIMIZATION_LEVELS.forEach((lvl: string) => flags.delete(lvl as OptimizationLevel));
        // Add newly selected flag
        flags.add(e.currentTarget.value as OptimizationLevel);
        this.props.onFlagsChange(Array.from(flags));
    };

    setCompilerFlag = (e: React.ChangeEvent<HTMLInputElement>): void => {
        const selected = new Set(this.props.selectedFlags);
        if (e.currentTarget.checked) {
            selected.add(e.currentTarget.value as CompilerFlag);
        } else {
            selected.delete(e.currentTarget.value as CompilerFlag);
        }
        this.props.onFlagsChange(Array.from(selected));
    };

    setRuntimeArgs = (e: React.ChangeEvent<HTMLInputElement>): void => {
        this.props.onRuntimeArgsChange(e.currentTarget.value);
    };

    makeCflagCheckboxes = (
        (flags: LabeledCompilerFlags): React.ReactNode[] => (
            flags.map((flag) => (
                <React.Fragment key={flag.flag}>
                    <label htmlFor={`cflag-${flag.flag.replace(' ', '-')}`}>
                        <input
                            id={`cflag-${flag.flag.replace(' ', '-')}`}
                            type="checkbox"
                            value={flag.flag}
                            onChange={this.setCompilerFlag}
                            checked={this.props.selectedFlags.includes(flag.flag)}
                        />
                        {flag.label}
                    </label>
                    <br />
                </React.Fragment>
            ))
        )
    );

    render(): React.ReactNode {
        const optimizationLevel = [...this.props.selectedFlags].find(
            (f: string) => OPTIMIZATION_LEVELS.includes(f),
        );
        return (
            <div className="sidebar">
                <h3>Language/version</h3>
                <select
                    id="language-select"
                    value={this.props.selectedVersion}
                    onChange={this.setCompilerVersion}
                >
                    { SUPPORTED_VERSIONS.map((lang) => (
                        <option key={lang} value={lang}>{lang}</option>)) }
                </select>

                <h3>Compiler flags</h3>
                <div id="compiler-flags">
                    <select
                        id="compiler-optimization"
                        value={optimizationLevel}
                        onChange={this.setOptimizationLevel}
                    >
                        { OPTIMIZATION_LEVELS.map((flag) => (
                            <option key={flag} value={flag}>{flag}</option>
                        )) }
                    </select>

                    <div className="flag-spacer" />

                    { this.makeCflagCheckboxes(COMPILER_FLAGS) }

                    <div className="flag-spacer" />

                    { this.makeCflagCheckboxes(LINKER_FLAGS) }

                </div>

                <h3>Program arguments</h3>
                <input
                    type="text"
                    value={this.props.runtimeArgs}
                    onChange={this.setRuntimeArgs}
                />

                <h3>Include files</h3>
                <p>
                    <small>
                        You can upload a .zip file containing files you&rsquo;d like to use
                        with your program. It will be unzipped to the same directory as
                        the source code.
                    </small>
                </p>
                <p id="uploaded-filename">{/* {INCLUDE_FILE_NAME} */}</p>
                <i className="fas fa-times" id="btn-remove-uploaded-file" />
                <input id="input-include-file" type="file" accept=".zip, application/zip" />

                <div className="sidebar-footer-spacer" />
                <div className="sidebar-footer">
                    Made by <a href="https://reberhardt.com">Ryan Eberhardt</a> and{' '}
                    <a href="https://github.com/reberhardt7/cplayground/blob/master/AUTHORS.md">others</a>.<br />
                    Fork me on <a href="https://github.com/reberhardt7/cplayground">Github</a>!
                </div>
            </div>
        );
    }
}


export default Sidebar;

import * as React from 'react';

import {
    SUPPORTED_VERSIONS,
    OPTIMIZATION_LEVELS,
    COMPILER_FLAGS,
    LINKER_FLAGS, SupportedVersion, CompilerFlag, OptimizationLevel, Compiler, COMPILERS,
} from '../../common/constants';
import { uploadFile } from '../server-comm';
import { filterKeypress } from '../accessibility-utils';

type SidebarProps = {
    selectedVersion: SupportedVersion;
    selectedCompiler: Compiler;
    selectedFlags: CompilerFlag[];
    runtimeArgs: string;
    includeFileName: string;
    onVersionChange: (version: SupportedVersion) => void;
    onCompilerChange: (version: Compiler) => void;
    onFlagsChange: (flags: CompilerFlag[]) => void;
    onRuntimeArgsChange: (args: string) => void;
    onIncludeFileChange: (file: {id: string; name: string} | null) => void;
};

type SidebarState = {
    currentlyUploadingFile: boolean;
    fileUploadError: string;
};

type LabeledCompilerFlags =
    ReadonlyArray<typeof COMPILER_FLAGS[number] | typeof LINKER_FLAGS[number]>;

class Sidebar extends React.PureComponent<SidebarProps, SidebarState> {
    constructor(props: SidebarProps) {
        super(props);
        this.state = {
            currentlyUploadingFile: false,
            fileUploadError: '',
        };
    }

    setCompilerVersion = (e: React.ChangeEvent<HTMLSelectElement>): void => {
        this.props.onVersionChange(e.currentTarget.value as SupportedVersion);
    };

    setCompiler = (e: React.ChangeEvent<HTMLSelectElement>): void => {
        this.props.onCompilerChange(e.currentTarget.value as Compiler);
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

    uploadFile = (e: React.ChangeEvent<HTMLInputElement>): void => {
        const { target } = e;
        if (target.files.length < 1) {
            return;
        }
        const file = target.files[0];
        if (file.size > 10 ** 6) {
            this.setState({
                fileUploadError: 'The file you selected is too big. Max filesize 1MB',
            });
            return;
        }

        this.setState({
            fileUploadError: '',
            currentlyUploadingFile: true,
        });
        uploadFile(e.target.files[0]).then((fileId: string): void => {
            this.setState({
                currentlyUploadingFile: false,
            });
            this.props.onIncludeFileChange({ id: fileId, name: file.name });
            target.value = null;
        });
    };

    clearIncludeFile = (): void => {
        this.props.onIncludeFileChange(null);
    };

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

                <h3>Compiler</h3>
                <select
                    id="compiler-select"
                    value={this.props.selectedCompiler}
                    onChange={this.setCompiler}
                >
                    { COMPILERS.filter((comp) => (
                        this.props.selectedVersion.includes('++')
                            ? comp.includes('++')
                            : !comp.includes('++')
                    )).map(
                        (lang) => (
                            <option key={lang} value={lang}>{lang}</option>
                        ),
                    ) }
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
                {this.state.currentlyUploadingFile && <p><span className="small-loading-spinner" /></p>}
                <p className="file-upload-error">{this.state.fileUploadError}</p>
                <p id="uploaded-filename">{this.props.includeFileName}</p>
                <i
                    className="fas fa-times"
                    id="btn-remove-uploaded-file"
                    role="button"
                    aria-label="Remove uploaded file"
                    tabIndex={0}
                    onClick={this.clearIncludeFile}
                    onKeyDown={(e): void => filterKeypress(e, this.clearIncludeFile)}
                />
                <input
                    id="input-include-file"
                    type="file"
                    accept=".zip, application/zip"
                    onChange={this.uploadFile}
                />

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

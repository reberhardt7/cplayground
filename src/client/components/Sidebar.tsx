import * as React from 'react';

// Make sure this stays in sync with index.js in the backend
const SUPPORTED_VERSIONS = ['C99', 'C11', 'C++11', 'C++14', 'C++17'];
const DEFAULT_VERSION = 'C++17';
const OPTIMIZATION_LEVELS = ['-O0', '-O1', '-O2', '-O3'];
const DEFAULT_OPTIMIZATION = '-O2';
const COMPILER_FLAGS = [
    { flag: '-Wall', label: '-Wall (recommended warnings)' },
    { flag: '-no-pie', label: '-no-pie (disable relocations)' },
    { flag: '-fpie -Wl,-pie', label: '-fpie -Wl,-pie (ASLR)' },
    {
        flag: '-fstack-protector-strong',
        label: '-fstack-protector-strong (anti-stack smashing)',
    },
];
const LINKER_FLAGS = [
    { flag: '-lm', label: '-lm (math)' },
    { flag: '-pthread', label: '-pthread (threading)' },
    { flag: '-lcrypt', label: '-lcrypt (crypto)' },
    { flag: '-lreadline', label: '-lreadline' },
    { flag: '-lrt', label: '-lrt' },
];

type SidebarProps = {
};

type SidebarState = {
    selectedVersion: typeof SUPPORTED_VERSIONS[number];
    selectedOptimization: typeof OPTIMIZATION_LEVELS[number];
    selectedFlags: Set<string>;
    runtimeArgs: string;
};

class Sidebar extends React.PureComponent<SidebarProps, SidebarState> {
    constructor(props: SidebarProps) {
        super(props);
        this.state = {
            selectedVersion: DEFAULT_VERSION,
            selectedOptimization: DEFAULT_OPTIMIZATION,
            selectedFlags: new Set(['-Wall', '-no-pie', '-lm', '-pthread']),
            runtimeArgs: '',
        };
    }

    setCompilerVersion = (e: React.ChangeEvent<HTMLSelectElement>): void => {
        this.setState({ selectedVersion: e.currentTarget.value });
    };

    setOptimizationLevel = (e: React.ChangeEvent<HTMLSelectElement>): void => {
        this.setState({ selectedOptimization: e.currentTarget.value });
    };

    setCompilerFlag = (e: React.ChangeEvent<HTMLInputElement>): void => {
        const selected = new Set(this.state.selectedFlags);
        if (e.currentTarget.checked) {
            selected.add(e.currentTarget.value);
        } else {
            selected.delete(e.currentTarget.value);
        }
        this.setState({ selectedFlags: selected });
    };

    setRuntimeArgs = (e: React.ChangeEvent<HTMLInputElement>): void => {
        this.setState({ runtimeArgs: e.currentTarget.value });
    };

    makeCflagCheckboxes = (
        (flags: typeof COMPILER_FLAGS | typeof LINKER_FLAGS): React.ReactNode[] => (
            flags.map((flag) => (
                <React.Fragment key={flag.flag}>
                    <label htmlFor={`cflag-${flag.flag.replace(' ', '-')}`}>
                        <input
                            id={`cflag-${flag.flag.replace(' ', '-')}`}
                            type="checkbox"
                            value={flag.flag}
                            onChange={this.setCompilerFlag}
                            checked={this.state.selectedFlags.has(flag.flag)}
                        />
                        {flag.label}
                    </label>
                    <br />
                </React.Fragment>
            ))
        )
    );

    render(): React.ReactNode {
        return (
            <div className="sidebar">
                <h3>Language/version</h3>
                <select
                    id="language-select"
                    value={this.state.selectedVersion}
                    onChange={this.setCompilerVersion}
                >
                    { SUPPORTED_VERSIONS.map((lang) => (
                        <option key={lang} value={lang}>{lang}</option>)) }
                </select>

                <h3>Compiler flags</h3>
                <div id="compiler-flags">
                    <select
                        id="compiler-optimization"
                        value={this.state.selectedOptimization}
                        onChange={this.setOptimizationLevel}
                    >
                        { OPTIMIZATION_LEVELS.map((flag) => (
                            <option value={flag}>{flag}</option>
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
                    value={this.state.runtimeArgs}
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
                    Made by <a href="https://reberhardt.com">Ryan Eberhardt</a> and Blanca Villanueva.<br />
                    Fork me on <a href="https://github.com/reberhardt7/cplayground">Github</a>!
                </div>
            </div>
        );
    }
}


export default Sidebar;

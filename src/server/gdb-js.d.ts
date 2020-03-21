// Type definitions for gdb-js
// Project: https://github.com/taskcluster/gdb-js
// Definitions by: Ryan Eberhardt <https://github.com/reberhardt7>

declare module 'gdb-js' {
    import { Readable } from 'stream';
    import EventEmitter from 'events';

    /**
     * Class representing a variable.
     */
    export class Variable {
        /**
         * Create a variable object.
         * Usually you don't need to create it yourself.
         *
         * @param {object} options The options object.
         * @param {string} options.name The name of the variable.
         * @param {string} options.type The type of the variable.
         * @param {string} options.scope The scope of the variable.
         * @param {string} options.value The value of the variable.
         */
        constructor(options?: {
            name: string;
            type: string;
            scope: string;
            value: string;
        });

        /**
         * The name of the variable.
         *
         * @type {string}
         */
        name: string;
        /**
         * The type of the variable.
         *
         * @type {string}
         */
        type: string;
        /**
         * The scope of the variable.
         *
         * @type {string}
         */
        scope: string;
        /**
         * The value of the variable.
         *
         * @type {string}
         */
        value: string;
    }

    /**
     * Class representing a thread.
     */
    export class Thread {
        /**
         * Create a thread object.
         * Usually you don't need to create it yourself unless
         * you're doing some low-level stuff.
         *
         * @param {number} id The internal GDB ID of a thread.
         * @param {object} [options] The options object.
         * @param {string} [options.status] The thread status (e.g. `stopped`).
         * @param {ThreadGroup} [options.group] The thread group.
         * @param {Frame} [options.frame] The frame where thread is currently on.
         */
        constructor(id: number, options?: {
            status?: string;
            group?: any;
            frame?: any;
        });

        /**
         * The internal GDB ID of a thread.
         *
         * @type {number}
         */
        id: number;
        /**
         * The thread status (e.g. `stopped`).
         *
         * @type {?string}
         */
        status: 'running' | 'stopped' | null;
        /**
         * The thread group.
         *
         * @type {?ThreadGroup}
         */
        group: ThreadGroup | null;
        /**
         * The frame where thread is currently on.
         *
         * @type {?Frame}
         */
        frame: Frame | null;
    }

    /**
     * Class representing a breakpoint.
     */
    export class Breakpoint {
        /**
         * Create a breakpoint object.
         * Usually you don't need to create it yourself unless
         * you're doing some low-level stuff.
         *
         * @param {number} id The internal GDB ID of a breakpoint.
         * @param {object} [options] The options object.
         * @param {string} [options.file] The full path to a file in which breakpoint appears.
         * @param {number} [options.line] The line number at which the breakpoint appears.
         * @param {string|string[]} [options.func] The function in which the breakpoint appears
         *   or an array of functions (e.g. in case of templates).
         * @param {Thread} [options.thread] The thread for thread-specific breakpoints.
         */
        constructor(id: number, options?: {
            file?: string;
            line?: number;
            func?: string | string[];
            thread?: any;
        });

        /**
         * The internal GDB ID of a breakpoint.
         *
         * @type {number}
         */
        id: number;
        /**
         * The full path to a file in which breakpoint appears.
         *
         * @type {?string}
         */
        file: string | null;
        /**
         * The line number at which the breakpoint appears.
         *
         * @type {?number}
         */
        line: number | null;
        /**
         * The function in which the breakpoint appears
         * or an array of functions (e.g. in case of templates).
         *
         * @type {?string|string[]}
         */
        func: (string | string[]) | null;
        /**
         * The thread for thread-specific breakpoints.
         *
         * @type {?Thread}
         */
        thread: Thread | null;
    }

    /**
     * Class representing an internal GDB error.
     *
     * @extends Error
     */
    export class GDBError extends Error {
        /**
         * Create a GDBError.
         *
         * @param {string} cmd Command that led to this error.
         * @param {string} msg Error message.
         * @param {number} [code] Error code.
         *
         * @private
         */
        private constructor();

        /**
         * Command that led to this error.
         *
         * @type {string}
         **/
        command: string;
        /**
         * Error code.
         *
         * @type {?number}
         **/
        code: number | null;
    }

    /**
     * Class representing a frame.
     */
    export class Frame {
        /**
         * Create a frame object.
         *
         * @param {object} options The options object.
         * @param {string} options.file The full path to a file.
         * @param {number} options.line The line number.
         * @param {string} [options.func] The func.
         * @param {number} [options.level] The level of stack frame.
         */
        constructor(options?: {
            file: string;
            line: number;
            func?: string;
            level?: number;
        });

        /**
         * The full path to a file.
         *
         * @type {string}
         */
        file: string;
        /**
         * The line number.
         *
         * @type {number}
         */
        line: number;
        /**
         * The func.
         * @type {?string}
         */
        func: string | null;
        /**
         * The level of stack frame.
         *
         * @type {?number}
         */
        level: number | null;
    }

    /**
     * Class representing a thread group (aka target, aka inferior).
     */
    export class ThreadGroup {
        /**
         * Create a thread group object.
         * Usually you don't need to create it yourself unless
         * you're doing some low-level stuff.
         *
         * @param {number} id The internal GDB ID of a thread group.
         * @param {object} [options] The options object.
         * @param {string} [options.executable] The executable of target.
         * @param {number} [options.pid] The PID of the thread-group.
         */
        constructor(id: number, options?: {
            executable?: string;
            pid?: number;
        });

        /**
         * The internal GDB ID of a thread group.
         *
         * @type {number}
         */
        id: number;
        /**
         * The executable of target.
         *
         * @type {?string}
         */
        executable: string | null;
        /**
         * The PID of the thread-group.
         *
         * @type {?number}
         */
        pid: number | null;
    }

    /**
     * Task to execute.
     *
     * @name Task
     * @function
     * @returns {Promise<any, GDBError>|any} Whatever.
     *
     * @ignore
     */
    /**
     * Class representing a GDB abstraction.
     *
     * @extends EventEmitter
     * @public
     */
    export class GDB extends EventEmitter {
        /**
         * Create a GDB wrapper.
         *
         * @param {object} childProcess A Node.js child process or just an
         *   object with `stdin`, `stdout`, `stderr` properties that are Node.js streams.
         *   If you're using GDB all-stop mode, then it should also have implementation of
         *   `kill` method that is able to send signals (such as `SIGINT`).
         */
        constructor(childProcess: any);

        _process: any;
        /**
         * The main queue of commands sent to GDB.
         *
         * @ignore
         */
        _queue: any;
        /**
         * The mutex to make simultaneous execution of public methods impossible.
         *
         * @ignore
         */
        _lock: any;
        /**
         * Raw output of GDB/MI console records.
         *
         * @type {Readable<string>}
         */
        consoleStream: Readable;
        /**
         * Raw output of GDB/MI log records.
         * The log stream contains debugging messages being produced by gdb's internals.
         *
         * @type {Readable<string>}
         */
        logStream: Readable;
        /**
         * Raw output of GDB/MI target records.
         * The target output stream contains any textual output from the running target.
         * Please, note that it's currently impossible
         * to distinguish the target and the MI output correctly due to a bug in GDB/MI. Thus,
         * it's recommended to use `--tty` option with your GDB process.
         *
         * @type {Readable<string>}
         */
        targetStream: Readable;

        /**
         * Get the child process object.
         *
         * @type {object}
         * @readonly
         */
        get process(): any;

        /**
         * Extend GDB CLI interface with some useful commands that are
         * necessary for executing some methods of this GDB wrapper
         * (e.g. {@link GDB#context|context}, {@link GDB#execCLI|execCLI}).
         * It also enables custom actions (like {@link GDB#new-objfile|`new-objfile` event}).
         *
         * @returns {Promise<undefined, GDBError>} A promise that resolves/rejects
         *   after completion of a GDB command.
         */
        init(): Promise<undefined>;

        /**
         * Set internal GDB variable.
         *
         * @param {string} param The name of a GDB variable.
         * @param {string} value The value of a GDB variable.
         *
         * @returns {Promise<undefined, GDBError>} A promise that resolves/rejects
         *   after completion of a GDB command.
         */
        set(param: string, value: string): Promise<undefined>;

        /**
         * Enable the `detach-on-fork` option which will automatically
         * attach GDB to any of forked processes. Please, note that it makes
         * sense only for systems that support `fork` and `vfork` calls.
         * It won't work for Windows, for example.
         *
         * @returns {Promise<undefined, GDBError>} A promise that resolves/rejects
         *   after completion of a GDB command.
         */
        attachOnFork(): Promise<undefined>;

        /**
         * Enable async and non-stop modes in GDB. This mode is *highly* recommended!
         *
         * @returns {Promise<undefined, GDBError>} A promise that resolves/rejects
         *   after completion of a GDB command.
         */
        enableAsync(): Promise<undefined>;

        _async: boolean;

        /**
         * Attach a new target (inferior) to GDB.
         *
         * @param {number} pid The process id or to attach.
         *
         * @returns {Promise<ThreadGroup, GDBError>} A promise that resolves/rejects
         *   with the added thread group.
         */
        attach(pid: number): Promise<ThreadGroup>;

        /**
         * Detache a target (inferior) from GDB.
         *
         * @param {ThreadGroup|number} process The process id or the thread group to detach.
         *
         * @returns {Promise<undefined, GDBError>} A promise that resolves/rejects
         *   after completion of a GDB command.
         */
        detach(process: number | ThreadGroup): Promise<undefined>;

        /**
         * Interrupt the target. In all-stop mode and in non-stop mode without arguments
         * it interrupts all threads. In non-stop mode it can interrupt only specific thread or
         * a thread group.
         *
         * @param {Thread|ThreadGroup} [scope] The thread or thread-group to interrupt.
         *   If this parameter is omitted, it will interrupt all threads.
         *
         * @returns {Promise<undefined, GDBError>} A promise that resolves/rejects
         *   after completion of a GDB command.
         */
        interrupt(scope?: ThreadGroup | Thread): Promise<undefined>;

        /**
         * Get the information about all the threads or about specific threads.
         *
         * @param {Thread|ThreadGroup} [scope] Get information about threads of the specific
         *   thread group or even about the specific thread (if it doesn't have enough information
         *   or it's outdated). If this parameter is absent, then information about all
         *   threads is returned.
         *
         * @returns {Promise<Thread[]|Thread, GDBError>} A promise that resolves with an array
         *   of threads or a single thread.
         */
        threads(scope?: ThreadGroup | Thread): Promise<Thread | Thread[]>;

        /**
         * Get the current thread.
         *
         * @returns {Promise<Thread, GDBError>} A promise that resolves with a thread.
         */
        currentThread(): Promise<Thread>;

        /**
         * Although you can pass scope to commands, you can also explicitly change
         * the context of command execution. Sometimes it might be slightly faster.
         *
         * @param {Thread} thread The thread that should be selected.
         *
         * @returns {Promise<undefined, GDBError>} A promise that resolves/rejects
         *   after completion of a GDB command.
         */
        selectThread(thread: Thread): Promise<undefined>;

        /**
         * Get thread groups.
         *
         * @returns {Promise<ThreadGroup[], GDBError>} A promise that resolves with
         *   an array thread groups.
         */
        threadGroups(): Promise<ThreadGroup[]>;

        /**
         * Get the current thread group.
         *
         * @returns {Promise<ThreadGroup, GDBError>} A promise that resolves with the thread group.
         */
        currentThreadGroup(): Promise<ThreadGroup>;

        /**
         * Although you can pass scope to commands, you can also explicitly change
         * the context of command execution. Sometimes it might be slightly faster.
         *
         * @param {ThreadGroup} group The thread group that should be selected.
         *
         * @returns {Promise<undefined, GDBError>} A promise that resolves/rejects
         *   after completion of a GDB command.
         */
        selectThreadGroup(group: ThreadGroup): Promise<undefined>;

        /**
         * Insert a breakpoint at the specified position.
         *
         * @param {string} file The full name or just a file name.
         * @param {number|string} pos The function name or a line number.
         * @param {Thread} [thread] The thread where breakpoint should be set.
         *   If this field is absent, breakpoint applies to all threads.
         *
         * @returns {Promise<Breakpoint, GDBError>} A promise that resolves with a breakpoint.
         */
        addBreak(file: string, pos: string | number, thread?: Thread): Promise<Breakpoint>;

        /**
         * Removes a specific breakpoint.
         *
         * @param {Breakpoint} [bp] The breakpoint.
         *
         * @returns {Promise<undefined, GDBError>} A promise that resolves/rejects
         *   after completion of a GDB command.
         */
        removeBreak(bp?: Breakpoint): Promise<undefined>;

        /**
         * Step in.
         *
         * @param {Thread|ThreadGroup} [scope] The thread or thread group where
         *   the stepping should be done.
         *
         * @returns {Promise<undefined, GDBError>} A promise that resolves/rejects
         *   after completion of a GDB command.
         */
        stepIn(scope?: ThreadGroup | Thread): Promise<undefined>;

        /**
         * Step back in.
         *
         * @param {Thread|ThreadGroup} [scope] The thread or thread group where
         *   the stepping should be done.
         *
         * @returns {Promise<undefined, GDBError>} A promise that resolves/rejects
         *   after completion of a GDB command.
         */
        reverseStepIn(scope?: ThreadGroup | Thread): Promise<undefined>;

        /**
         * Step out.
         *
         * @param {Thread|ThreadGroup} [scope] The thread or thread group where
         *   the stepping should be done.
         *
         * @returns {Promise<undefined, GDBError>} A promise that resolves/rejects
         *   after completion of a GDB command.
         */
        stepOut(scope?: ThreadGroup | Thread): Promise<undefined>;

        /**
         * Execute to the next line.
         *
         * @param {Thread|ThreadGroup} [scope] The thread or thread group where
         *   the stepping should be done.
         *
         * @returns {Promise<undefined, GDBError>} A promise that resolves/rejects
         *   after completion of a GDB command.
         */
        next(scope?: ThreadGroup | Thread): Promise<undefined>;

        /**
         * Execute to the previous line.
         *
         * @param {Thread|ThreadGroup} [scope] The thread or thread group where
         *   the stepping should be done.
         *
         * @returns {Promise<undefined, GDBError>} A promise that resolves/rejects
         *   after completion of a GDB command.
         */
        reverseNext(scope?: ThreadGroup | Thread): Promise<undefined>;

        /**
         * Run the current target.
         *
         * @param {ThreadGroup} [group] The thread group to run.
         *   If this parameter is omitted, current thread group will be run.
         *
         * @returns {Promise<undefined, GDBError>} A promise that resolves/rejects
         *   after completion of a GDB command.
         */
        run(group?: ThreadGroup): Promise<undefined>;

        /**
         * Continue execution.
         *
         * @param {Thread|ThreadGroup} [scope] The thread or thread group that should be continued.
         *   If this parameter is omitted, all threads are continued.
         *
         * @returns {Promise<undefined, GDBError>} A promise that resolves/rejects
         *   after completion of a GDB command.
         */
        proceed(scope?: ThreadGroup | Thread): Promise<undefined>;

        /**
         * Continue reverse execution.
         *
         * @param {Thread|ThreadGroup} [scope] The thread or thread group that should be continued.
         *   If this parameter is omitted, all threads are continued.
         *
         * @returns {Promise<undefined, GDBError>} A promise that resolves/rejects
         *   after completion of a GDB command.
         */
        reverseProceed(scope?: ThreadGroup | Thread): Promise<undefined>;

        /**
         * List all symbols in the current context (i.e. all global, static, local
         * variables and constants in the current file).
         *
         * @param {Thread} [thread] The thread from which the context should be taken.
         *
         * @returns {Promise<Variable[], GDBError>} A promise that resolves with
         *   an array of variables.
         */
        context(thread?: Thread): Promise<Variable[]>;

        /**
         * Get the callstack.
         *
         * @param {Thread} [thread] The thread from which the callstack should be taken.
         *
         * @returns {Promise<Frame[], GDBError>} A promise that resolves with an array of frames.
         */
        callstack(thread?: Thread): Promise<Frame[]>;

        /**
         * Get list of source files or a subset of source files that match
         * the regular expression. Please, note that it doesn't return sources.
         *
         * @example
         * let headers = await gdb.sourceFiles({ pattern: '\.h$' })
         *
         * @param {object} [options] The options object.
         * @param {ThreadGroup} [options.group] The thread group (i.e. target) for
         *   which source files are needed. If this parameter is absent, then
         *   source files are returned for all targets.
         * @param {string} [options.pattern] The regular expression (see
         *   {@link https://docs.python.org/2/library/re.html|Python regex syntax}).
         *   This option is useful when the project has a lot of files so that
         *   it's not desirable to send them all in one chunk along the wire.
         *
         * @returns {Promise<string[], GDBError>} A promise that resolves with
         *   an array of source files.
         */
        sourceFiles(options?: {
            group?: ThreadGroup;
            pattern?: string;
        }): Promise<string[]>;

        /**
         * Evaluate a GDB expression.
         *
         * @param {string} expr The expression to evaluate.
         * @param {Thread|ThreadGroup} [scope] The thread or thread group where
         *   the expression should be evaluated.
         *
         * @returns {Promise<string, GDBError>} A promise that resolves with the result of expression.
         */
        evaluate(expr: string, scope?: ThreadGroup | Thread): Promise<string>;

        /**
         * Exit GDB.
         *
         * @returns {Promise<undefined, GDBError>} A promise that resolves/rejects
         *   after completion of a GDB command.
         */
        exit(): Promise<undefined>;

        /**
         * Execute a custom python script and get the results of its excecution.
         * If your python script is asynchronous and you're interested in its output, you should
         * either define a new event (refer to the *Extending* section in the main page) or
         * read the {@link GDB#consoleStream|console stream}. Here's the example below.
         *
         * By the way, with this method you can define your own CLI commands and then call
         * them via {@link GDB#execCLI|execCLI} method. For more examples, refer to the *Extending*
         * section on the main page and read
         * {@link https://sourceware.org/gdb/current/onlinedocs/gdb/Python-API.html|official GDB Python API}
         * and {@link https://sourceware.org/gdb/wiki/PythonGdbTutorial|PythonGdbTutorial}.
         *
         * @example
         * let script = `
         * import gdb
         * import threading
         *
         *
         * def foo():
         *     sys.stdout.write('bar')
         *     sys.stdout.flush()
         *
         * timer = threading.Timer(5.0, foo)
         * timer.start()
         * `
         * gdb.consoleStream.on('data', (str) => {
         *   if (str === 'bar') console.log('yep')
         * })
         * await gdb.execPy(script)
         *
         * @param {string} src The python script.
         * @param {Thread} [thread] The thread where the script should be executed.
         *
         * @returns {Promise<string, GDBError>} A promise that resolves with the output of
         *   python script execution.
         */
        execPy(src: string, scope: any): Promise<string>;

        /**
         * Execute a CLI command.
         *
         * @param {string} cmd The CLI command.
         * @param {Thread|ThreadGroup} [scope] The thread where the command should be executed.
         *
         * @returns {Promise<string, GDBError>} A promise that resolves with
         *   the result of command execution.
         */
        execCLI(cmd: string, scope?: ThreadGroup | Thread): Promise<string>;

        /**
         * Execute a custom defined command. Refer to the *Extending* section on the main
         * page of the documentation.
         *
         * @param {string} cmd The name of the command.
         * @param {Thread|ThreadGroup} [scope] The thread or thread-group where
         *   the command should be executed. If this parameter is omitted,
         *   it executes in the current thread.
         *
         * @returns {Promise<object, GDBError>} A promise that resolves with
         *   the JSON representation of the result of command execution.
         */
        execCMD(cmd: string, scope?: ThreadGroup | Thread): Promise<any>;

        /**
         * Execute a MI command.
         *
         * @param {string} cmd The MI command.
         * @param {Thread|ThreadGroup} [scope] The thread or thread-group where
         *   the command should be executed. If this parameter is omitted,
         *   it executes in the current thread.
         *
         * @returns {Promise<object, GDBError>} A promise that resolves with
         *   the JSON representation of the result of command execution.
         */
        execMI(cmd: string, scope?: ThreadGroup | Thread): Promise<any>;

        /**
         * Internal method for setting values. See {@link GDB#set}.
         *
         * @ignore
         */
        _set(param: any, value: any): Promise<void>;

        /**
         * Internal method for getting the current thread. See {@link GDB#currentThread}.
         *
         * @ignore
         */
        _currentThread(): Promise<Thread>;

        /**
         * Internal method for getting the current thread group. See {@link GDB#currentThreadGroup}.
         *
         * @ignore
         */
        _currentThreadGroup(): Promise<ThreadGroup>;

        /**
         * Internal method for selecting the thread groups. See {@link GDB#selectThread}.
         *
         * @ignore
         */
        _selectThread(thread: any): Promise<void>;

        /**
         * Internal method for selecting the thread group. See {@link GDB#selectThreadGroup}.
         *
         * @ignore
         */
        _selectThreadGroup(group: any): Promise<void>;

        /**
         * Internal method for getting thread groups. See {@link GDB#threadGroups}.
         *
         * @ignore
         */
        _threadGroups(): Promise<any>;

        /**
         * Helps to restore the current thread between operations and avoid side effect.
         *
         * @param {Task} [task] The task to execute.
         *
         * @returns {Promise<any, GDBError>} A promise that resolves with task results.
         *
         * @ignore
         */
        _preserveThread(task?: any): Promise<any>;

        /**
         * Internal method for calling defined Python commands. See {@link GDB#execCMD}.
         *
         * @ignore
         */
        _execCMD(cmd: any, scope: any): Promise<any>;

        /**
         * Internal method for calling MI commands. See {@link GDB#execMI}.
         *
         * @ignore
         */
        _execMI(cmd: any, scope: any): Promise<any>;

        /**
         * Internal method that executes a MI command and add it to the queue where it
         * waits for the results of execution.
         *
         * @param {string} cmd The command (eaither a MI or a defined Python command).
         * @param {string} interpreter The interpreter that should execute the command.
         *
         * @returns {Promise<object, GDBError>} A promise that resolves with
         *   the JSON representation of the result of command execution.
         *
         * @ignore
         */
        _exec(cmd: string, interpreter: string): Promise<any>;

        /**
         * This routine makes it impossible to run multiple punlic methods
         * simultaneously. Why this matter? It's really important for public
         * methods to not interfere with each other, because they can change
         * the state of GDB during execution. They should be atomic,
         * meaning that calling them simultaneously should produce the same
         * results as calling them in order. One way to ensure that is to block
         * execution of public methods until other methods complete.
         *
         * @param {Task} task The task to execute.
         *
         * @returns {Promise<any, GDBError>} A promise that resolves with task results.
         *
         * @ignore
         */
        _sync(task: any): Promise<any>;
    }
}

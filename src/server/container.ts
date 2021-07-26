import * as path from 'path';
import * as fs from 'fs';
import * as net from 'net';
import * as os from 'os';
import * as childProcess from 'child_process';
import * as stringArgv from 'string-argv';
import uuidv4 from 'uuid/v4';
import * as ptylib from 'node-pty';
import semver from 'semver';
import * as readline from 'readline';
import { GDB, Breakpoint, Thread, ThreadGroup, Frame } from 'gdb-js';
// Import regeneratorRuntime as a global to fix errors in gdb-js:
// eslint-disable-next-line import/extensions
import 'regenerator-runtime/runtime.js';

import * as db from './db';
import * as debugging from './debugging';
import { ContainerInfo, Signal } from '../common/communication';
import { Compiler } from '../common/constants';
import { getPathFromRoot } from './util';
import { DebugStateError, SystemConfigurationError } from './error';

// eslint-disable-next-line no-undef
import Timeout = NodeJS.Timeout;

// How long should a program run for?
const DEFAULT_TIMEOUT = 90000;
// A program's timeout timer can be reset by I/O (e.g. so that if you're testing
// a shell, it doesn't get killed after only a minute), but can't exceed this time
const HARD_TIMEOUT = 480000;
// Prevent forkbombs and bitcoin mining:
const MAX_CPU_TIME = 15000;

const OUTPUT_BUFFER_MAX_LEN = db.OUTPUT_MAX_LEN;

export type ContainerExitNotification = {
    runtimeMs: number;
    exitStatus: number;
    signal: number;
    output: string;
}

interface ThreadStoppedEvent {
    type: 'stopped';
    thread: Thread;
    reason: string;
    stopSig: string;
}

interface ThreadRunningEvent {
    type: 'running';
    thread: Thread;
}

interface ThreadExitedEvent {
    type: 'exited';
    thread: Thread;
}

type ThreadEvent = ThreadStoppedEvent | ThreadRunningEvent | ThreadExitedEvent;

export default class Container {
    private readonly logPrefix: string;

    private readonly containerName = uuidv4();
    private containerId: string | null = null;
    private containerPid: number | null = null;
    private readonly startTime = process.hrtime();
    private pty: ptylib.IPty | null = null;
    private exited = false;
    private terminalWidth: number = null;

    private readonly dataHostPath = getPathFromRoot('data');
    private readonly codeHostPath = path.join(this.dataHostPath, this.containerName);
    private readonly includeFileHostPath = path.join(this.dataHostPath, `${this.containerName}-include.zip`);
    private readonly codeContainerPath: string;

    private gdbSocketPath: string | null = null;
    private gdbMiServer: net.Server | null = null;
    private gdb: GDB | null = null;

    private readonly initialBreakpoints: number[];
    private breakpoints: {[line: number]: Breakpoint} = {};
    private threads: {[threadId: number]: Thread} = {};
    private processes: {[inferiorId: number]: ThreadGroup} = {};
    private threadStoppedCallbacks: {[threadId: number]: ((e: ThreadEvent) => unknown)[]} = {};
    private threadContinuedCallbacks: {[threadId: number]: ((e: ThreadEvent) => unknown)[]} = {};
    // Store unix timestamp (in ms) of when the debugger finished initializing:
    private debuggerInitializationFinishedAt: null | number = null;
    // On regular intervals, we'll momentarily interrupt each thread to examine
    // where it's running, then continue the thread. We don't want the client
    // to see this, or else the state display will frequently flash between
    // stopped/running, and that's not good. So, when we're in the middle of
    // doing that, we can set this flag to suppress client updates.
    private suppressDebuggerUpdates = false;
    // Store the gdb function that was last used to continue a thread. Since we frequently interrupt
    // threads to inspect them, we need some way to resume them once we're done. We can't just
    // proceed(), because if we were previously stepping to the next line, then we'll proceed()
    // without stopping at the next line. This function stores the gdb function that we were
    // previously running so that we can resume by running it again.
    // TODO: this is pretty hacky and doesn't work great. For example, what should we do if we want
    // to step to the next line? If we interrupt the thread while it's in the library function and
    // then rerun next() to continue, that will step to the next line *in the library*, not in the
    // user code. We deal with this with some hacks for now, but we need a cleaner solution.
    private lastRunGdbContinueFunction: {[threadId: number]: ((thread: Thread) => unknown)} = {};

    private readonly externalOutputCallback: (data: string) => void;
    private readonly externalExitCallback: (data: ContainerExitNotification) => void;
    private readonly externalDebugCallback: (data: ContainerInfo) => void;

    private runTimeoutTimer: Timeout | null = null;
    private cpuQuotaMonitor: Timeout | null = null;
    private debuggingMonitor: Timeout | null = null;

    // Save container output to a buffer that can later be committed to the database
    private outputBuf = '';
    private warnOutputMaxSizeExceeded = true;

    constructor(
        logPrefix: string,
        code: string,
        includeFileData: Buffer | null,
        compiler: Compiler,
        cflags: string,
        argsStr: string,
        rows: number,
        cols: number,
        enableDebugging: boolean,
        breakpoints: number[],
        onOutput: (data: string) => void,
        onExit: (data: ContainerExitNotification) => void,
        onDebugInfo: (data: ContainerInfo) => void,
    ) {
        // Validate debug config. (NOTE: make sure all validation is done before
        // this.saveCodeFiles, so that we don't leak resources on exception.)
        if (!enableDebugging && breakpoints.length > 0) {
            throw new DebugStateError('Debugging is not enabled, yet breakpoints are specified');
        }

        this.logPrefix = logPrefix;
        this.terminalWidth = cols;
        this.externalOutputCallback = onOutput;
        this.externalExitCallback = onExit;
        this.externalDebugCallback = onDebugInfo;
        this.initialBreakpoints = breakpoints;

        // Save the code to disk so that the files can be mounted into the container
        this.saveCodeFiles(code, includeFileData);

        const fileExtension = compiler === 'gcc' ? '.c' : '.cpp';
        this.codeContainerPath = `/cplayground/code${fileExtension}`;

        // Add -g flag to compiler if debugging is enabled. (Otherwise, the compiler won't
        // generate a symbol table for the debugger to use.)
        const debugAwareCflags = enableDebugging ? `-g ${cflags}` : cflags;
        // Set up debug socket, if applicable; then, start the container
        (enableDebugging ? this.initializeDebugSocket() : Promise.resolve()).then(() => {
            this.startContainer(compiler, debugAwareCflags, argsStr, rows, cols, enableDebugging)
                .then();
        });
    }

    private saveCodeFiles = (code: string, includeFileData: Buffer | null): void => {
        // Create data directory and save code from request
        console.log(`${this.logPrefix}Saving code to ${this.codeHostPath}`);
        if (!fs.existsSync(this.dataHostPath)) fs.mkdirSync(this.dataHostPath);
        fs.writeFileSync(this.codeHostPath, code);
        if (includeFileData) {
            console.log(`${this.logPrefix}Writing include file to ${this.includeFileHostPath}`);
            fs.writeFileSync(this.includeFileHostPath, includeFileData);
        }
    };

    /**
     * Set up Unix domain socket that can be bind-mounted into the container, so that we can
     * communicate with gdb (running inside the container)
     */
    private initializeDebugSocket = (): Promise<void> => {
        this.gdbSocketPath = path.join(this.dataHostPath, `${this.containerName}-gdb.sock`);
        this.gdbMiServer = net.createServer(this.onGdbSocketConnection);
        return new Promise<void>((resolve) => {
            this.gdbMiServer.listen(this.gdbSocketPath, () => {
                resolve();
            });
        }).then(
            // TODO: figure out a way to allow access from the container's user (uid 999)
            //  without allowing access to *all* users. Keep in mind that we don't know what the
            //  host's uid is at compile time.
            () => fs.promises.chmod(this.gdbSocketPath, '777'),
        ).then(() => {
            console.log(`${this.logPrefix}Successfully created gdb socket at ${
                this.gdbSocketPath}`);
        });
    };

    private generateDockerRunArgs = async (
        compiler: Compiler, cflags: string, argsStr: string,
    ): Promise<string[]> => {
        const runArgs = [
            '-it', '--name', this.containerName,
            // Make the entire FS read-only, except for the home directory
            // /cplayground, which we impose a 32MB storage quota on.
            // NOTE: In the future, it may be easier to impose a disk quota
            // using the --storage-opt flag. However, this currently requires
            // use of a specific storage driver and backing filesystem, and
            // it's too complicated to set up on the host. Links for future
            // reference:
            // https://forums.docker.com/t/./37653
            // https://github.com/machinelabs/machinelabs/issues/703
            '--read-only',
            '--tmpfs', '/cplayground:mode=0777,size=32m,exec',
            // Add the code to the container and set options
            '-v', `${this.codeHostPath}:${this.codeContainerPath}:ro`,
            '-v', `${this.includeFileHostPath}:/cplayground/include.zip:ro`,
            '-e', `COMPILER=${compiler}`,
            '-e', `CFLAGS=${cflags}`,
            '-e', `SRCPATH=${this.codeContainerPath}`,
            // Drop all capabilities. (We add back the ptrace capability if debugging is enabled)
            '--cap-drop=all',
            // Set more resource limits and disable networking
            '--memory', '256mb',
            '--memory-swap', '256mb',
            '--memory-reservation', '96mb',
            '--cpu-shares', '512',
            '--pids-limit', '16',
            '--ulimit', 'cpu=10:11',
            '--ulimit', 'nofile=64',
            '--network', 'none',
        ];
        // If debugging is enabled, set up for gdb
        if (this.gdbSocketPath) {
            // Bind mount the gdb socket so that we can communicate with gdb
            runArgs.push('-v', `${this.gdbSocketPath}:/gdb.sock`);
            // Make sure it's safe to use ptrace
            if (os.platform() !== 'linux' || semver.lt(semver.coerce(os.release()), '4.8.0')) {
                throw new SystemConfigurationError('ptrace is not safe to use on linux versions '
                    + 'older than 4.8, as it can be used to bypass seccomp.');
            }
            // Docker itself runs the above check too, and grants the ptrace syscall in its seccomp
            // profile (without granting the dangerous CAP_SYS_PTRACE) on kernel versions past 4.8,
            // meaning we need not do anything to give gdb the perms it needs

            // Tell run.py to run in debug mode
            runArgs.push('-e', 'CPLAYGROUND_DEBUG=1');
        }

        return ['run',
            ...runArgs,
            'cplayground', '/run.py',
        ].concat(
            // Safely parse argument string from user
            stringArgv.parseArgsStringToArgv(argsStr),
        );
    };

    private startContainer = async (
        compiler: Compiler, cflags: string, argsStr: string, rows: number, cols: number,
        enableDebugging: boolean,
    ): Promise<void> => {
        // Start the container
        // TODO: clean up container/files even if the server crashes
        const dockerRunArgs = await this.generateDockerRunArgs(compiler, cflags, argsStr);
        console.log(`${this.logPrefix}Starting container: docker ${dockerRunArgs.join(' ')}`);
        console.log(`${this.logPrefix}Initial terminal size ${rows}x${cols}`);
        this.pty = ptylib.spawn('docker', dockerRunArgs, {
            name: 'xterm-color',
            rows,
            cols,
        });
        this.pty.onData(this.onOutput);
        this.pty.onExit(this.onExit);

        // Start resource limit timers
        this.setRunTimeoutMonitor();
        this.setCpuQuotaMonitor();
        if (enableDebugging) {
            this.setDebuggingMonitor();
        } else {
            console.info(
                `${this.logPrefix}Debugging is disabled. "debug" events will not be sent to the client.`,
            );
        }
    };

    private trySettingContainerId = async (): Promise<void> => new Promise((resolve) => (
        childProcess.execFile('docker',
            ['ps', '--no-trunc', '-aqf', `name=${this.containerName}`],
            (err, out) => {
                if (err) throw err;
                this.containerId = out.trim();
                console.log(`${this.logPrefix}Container id: ${this.containerId}`);
                resolve();
            })
    ));

    private setContainerPid = async (): Promise<void> => {
        if (!this.containerId) {
            await this.trySettingContainerId();
        }
        const pidFile = `/sys/fs/cgroup/pids/docker/${this.containerId}/cgroup.procs`;
        console.log(`${this.logPrefix}Looking up container pid`);

        const stream = fs.createReadStream(pidFile);
        stream.on('error', (err) => {
            if (err.code === 'ENOENT') {
                console.log(`Note: file ${pidFile} has disappeared. This is probably `
                    + 'okay; the container probably just exited.');
            } else {
                console.error(`Unexpected error reading ${pidFile}:`, err);
            }
        });
        const rl = readline.createInterface({
            input: stream,
        });
        for await (const line of rl) {
            this.containerPid = parseInt(line, 10);
            rl.close();
            break;
        }
        console.log(`${this.logPrefix}Container pid set: ${this.containerPid}`);
    };

    private onOutput = async (data: string): Promise<void> => {
        // Get container ID. This is jank, but this is the best way to set the container ID
        // that I could come up with. ptylib.spawn() above initiates the container launch, but
        // there's no way to tell that docker has actually finished creating the container until
        // the container starts printing stuff. So, if we get here, we know it's safe to query
        // the container ID.
        if (!this.containerId) {
            this.trySettingContainerId();
        }

        // Store output
        if (this.outputBuf.length + data.length < OUTPUT_BUFFER_MAX_LEN) {
            this.outputBuf += data;
        } else if (this.warnOutputMaxSizeExceeded) {
            console.warn(`${this.logPrefix}Program output exceeded max length for db storage!`);
            this.warnOutputMaxSizeExceeded = false;
        }

        // Report outputted data
        this.externalOutputCallback(data);
    };

    private onExit = ({ exitCode, signal }: {exitCode: number; signal: number}): void => {
        this.exited = true;
        const runtime = this.getContainerRunTimeMs();
        console.info(`${this.logPrefix}Container exited! Status ${exitCode}, signal ${signal}, `
            + `node-side runtime measured at ${runtime}ms`);

        clearTimeout(this.runTimeoutTimer);
        clearInterval(this.cpuQuotaMonitor);
        clearInterval(this.debuggingMonitor);
        // Remove uploaded file. We don't care about errors, in case the file
        // was already removed (or was never successfully created to begin
        // with)
        try { fs.unlinkSync(this.codeHostPath); } catch { /* ignore */ }
        try { fs.unlinkSync(this.includeFileHostPath); } catch { /* ignore */ }
        // Shut down gdb server, if it's running
        if (this.gdbMiServer) {
            this.gdbMiServer.close();
        }

        this.externalExitCallback({
            runtimeMs: runtime,
            exitStatus: exitCode,
            signal,
            output: this.outputBuf,
        });
    };

    private showErrorBanner = (text: string): void => {
        // Note: if you modify these constants, be sure to update run.py to
        // match
        const fg = '\x1b[91m'; // red
        const bg = '\x1b[100m'; // light gray

        const bannerWidth = Math.max(this.terminalWidth, text.length);
        const lpad = ' '.repeat(Math.floor((bannerWidth - text.length) / 2));
        const rpad = ' '.repeat(Math.ceil((bannerWidth - text.length) / 2));
        this.externalOutputCallback(`${fg + bg + lpad + text + rpad}\x1b[0m`);
    };

    private getContainerRunTimeMs = (): number => {
        const runtimeHt = process.hrtime(this.startTime);
        return runtimeHt[0] * 1000 + runtimeHt[1] / 1000000;
    };

    private onGdbSocketConnection = async (sock: net.Socket): Promise<void> => {
        console.log(`${this.logPrefix}Received connection on gdb socket`);
        this.gdb = new GDB({
            stdin: sock,
            stdout: sock,
            stderr: sock,
        });
        // gdb-js adds an error listener that terminates our node server if an error occurs on
        // the socket. This is obviously bad... Let's replace it
        sock.removeAllListeners('error');
        sock.on('error', (err) => {
            console.warn('Error on gdb socket: ', err);
            sock.destroy();
            sock.unref();
        });
        this.gdb.on('notify', async (e) => {
            console.debug(`${this.logPrefix}[gdb] event: notify`, e);
            // Quit gdb once thread 1 exits. (We do this since cplayground terminates the
            // container after the main process exits when running in non-debug mode.)
            if (e.state === 'thread-group-exited' && e.data.id === 'i1') {
                // Inferior 1 has exited
                if (e.data['exit-code'] !== undefined) {
                    // Process exited normally
                    await this.gdb.execCLI(`quit ${e.data['exit-code']}`);
                } else {
                    // If the exit code is undefined, we assume the process was signalled.
                    // Unfortunately, gdb doesn't provide the signal in the thread-group-exited
                    // event (it appears in the stopped event but it's kind of complicated to get),
                    // so we rely on the gdb $_exitsignal variable. This could cause a race
                    // condition if a second inferior were to be killed after the delivery of
                    // this event but before we send the quit command (since $_exitsignal would
                    // contain that inferior's signal), but the likelihood of this is small
                    // enough that we won't worry about it for now.
                    await this.gdb.execCLI('quit 128 + $_exitsignal');
                }
            }
        });
        this.gdb.on('exec', (e) => {
            console.debug(`${this.logPrefix}[gdb] event: exec`, e);

            // Handle "stopped" and "running" events here. We do this instead
            // of using the gdb-js stopped/running events, because the exec
            // event gives us more info about what happened (e.g. the signal
            // that caused the thread to stop), and much of this info is lost
            // in the running/stopped event objects.

            if (e.state === 'stopped' && e.data['thread-id']) {
                const threadId = parseInt(e.data['thread-id'], 10);
                this.threads[threadId].status = 'stopped';
                this.threads[threadId].frame = new Frame({
                    file: e.data.frame.fullname,
                    line: parseInt(e.data.frame.line, 10),
                    func: e.data.frame.func,
                });

                // TODO: /cplayground/code check is brittle
                if ((e.data.reason === 'location-reached' || e.data.reason === 'function-finished'
                        || e.data.reason === 'end-stepping-range')
                    && !e.data.frame.fullname.startsWith('/cplayground/code.')) {
                    // We stopped in a function in a different file (e.g. maybe in the standard
                    // library). Step debugging is going to be rough here, because the source isn't
                    // shown to the user. Let's step out of this code until we get back to user
                    // code.
                    console.debug(`${this.logPrefix}Stopped within non-user code. Stepping out...`);
                    this.gdb.stepOut(this.threads[threadId]);
                    // Cancel any further processing. When the inferior stops after getting out of
                    // this function, this callback will be invoked again, and we can run any later
                    // logic at that point.
                    return;
                }

                // Notify anyone waiting for this thread to stop
                if (this.threadStoppedCallbacks[threadId] !== undefined) {
                    const callbacks = this.threadStoppedCallbacks[threadId];
                    delete this.threadStoppedCallbacks[threadId];
                    for (const callback of callbacks) {
                        callback({
                            type: 'stopped',
                            thread: this.threads[threadId],
                            reason: e.data.reason,
                            stopSig: e.data['signal-name'],
                        });
                    }
                }
            } else if (e.state === 'running' && e.data['thread-id']) {
                const threadId = parseInt(e.data['thread-id'], 10);
                this.threads[threadId].status = 'running';
                this.threads[threadId].frame = null;

                // Notify anyone waiting for this thread to continue
                if (this.threadContinuedCallbacks[threadId] !== undefined) {
                    const callbacks = this.threadContinuedCallbacks[threadId];
                    delete this.threadContinuedCallbacks[threadId];
                    for (const callback of callbacks) {
                        callback({ type: 'running', thread: this.threads[threadId] });
                    }
                }
            }

            if (e.state === 'stopped' || e.state === 'running') {
                // Send the client an update. (Reset the debugging monitor so that we don't
                // inadvertently send two updates in quick succession, which is unnecessary.)
                this.reportDebugInfo().then(this.setDebuggingMonitor);
            }
        });
        this.gdb.on('thread-created', (thread: Thread) => {
            console.debug(`${this.logPrefix}[gdb] event: thread-created`, thread);
            this.threads[thread.id] = thread;
        });
        this.gdb.on('thread-exited', (thread: Thread) => {
            console.debug(`${this.logPrefix}[gdb] event: thread-exited`, thread);
            delete this.threads[thread.id];
            if (thread && this.threadStoppedCallbacks[thread.id] !== undefined) {
                const callbacks = this.threadStoppedCallbacks[thread.id];
                delete this.threadStoppedCallbacks[thread.id];
                for (const callback of callbacks) callback({ type: 'exited', thread });
            }
            // Send the client an update. (Reset the debugging monitor so that we don't
            // inadvertently send two updates in quick succession, which is unnecessary.)
            this.reportDebugInfo().then(this.setDebuggingMonitor);
        });
        this.gdb.on('thread-group-started', (group: ThreadGroup) => {
            console.debug(`${this.logPrefix}[gdb] event: thread-group-started`, group);
            this.processes[group.id] = group;
        });
        this.gdb.on('thread-group-exited', (group: ThreadGroup) => {
            console.debug(`${this.logPrefix}[gdb] event: thread-group-exited`, group);
            delete this.processes[group.id];
        });
        this.gdb.logStream.on('data', (e) => {
            console.debug(`${this.logPrefix}[gdb] log message`, e);
        });
        await this.gdb.init();
        await this.gdb.enableAsync();
        await this.gdb.attachOnFork();

        // Set and save initial breakpoints
        const initialBreakpointObjs = await Promise.all(this.initialBreakpoints.map(
            (lineno) => this.gdb.addBreak(this.codeContainerPath, lineno),
        ));
        initialBreakpointObjs.forEach((bp) => { this.breakpoints[bp.line] = bp; });
        console.debug(`${this.logPrefix}Set ${initialBreakpointObjs.length} initial breakpoints`,
            initialBreakpointObjs);

        // Go!
        console.debug(`${this.logPrefix}Issuing run command!`);
        await this.gdb.run();
        this.debuggerInitializationFinishedAt = Date.now();
    };

    /**
     * Kill the container if it doesn't finish running within DEFAULT_TIMEOUT ms
     */
    private setRunTimeoutMonitor = (): void => {
        // If there is already a timer running, stop it so we can reset it
        if (this.runTimeoutTimer !== null) {
            clearTimeout(this.runTimeoutTimer);
        }
        // Set the execution timeout timer to DEFAULT_TIMEOUT ms. If doing so would exceed the
        // HARD_TIMEOUT limit, then reset it to as long as we can without exceeding HARD_TIMEOUT.
        this.runTimeoutTimer = setTimeout(() => {
            console.warn(`${this.logPrefix}Container ${this.containerName} hasn't finished `
                + 'running in time! Killing container');
            childProcess.execFile('docker', ['kill', this.containerName]);
            this.showErrorBanner('The program took too long to run.');
        }, Math.min(HARD_TIMEOUT - this.getContainerRunTimeMs(), DEFAULT_TIMEOUT));
    };

    /**
     * Every second, check if this container has exceeded the max amount of CPU time. (I did a
     * lot of research, and at least at the time I'm writing this, there's no way to set a max
     * cpu limit on an entire cgroup. You can set a max cpu time on individual processes, but
     * that doesn't help when mitigating forkbombs.
     */
    private setCpuQuotaMonitor = (): void => {
        // If there is already a timer running, stop it so we can reset it
        if (this.cpuQuotaMonitor !== null) {
            clearInterval(this.cpuQuotaMonitor);
        }
        // Set timer
        this.cpuQuotaMonitor = setInterval(() => {
            // If we don't have the containerId yet, the container might not
            // have started yet, and there's not much we can do
            if (!this.containerId) return;

            let cpuUsageNs;
            try {
                // TODO: get rid of synchronous read
                cpuUsageNs = parseInt(
                    fs.readFileSync(
                        `/sys/fs/cgroup/cpu/docker/${this.containerId}/cpuacct.usage`,
                    ).toString(),
                    10,
                );
            } catch (exc) {
                console.warn(`${this.logPrefix}Error loading cgroup CPU usage!`, exc);
                return;
            }
            const cpuUsageMs = cpuUsageNs / 1000000;
            console.debug(`${this.logPrefix}Current CPU time used: ${cpuUsageMs}ms`);
            if (cpuUsageMs > MAX_CPU_TIME) {
                console.warn(`${this.logPrefix}Container ${this.containerName} exceeded its CPU `
                    + 'quota! Killing container');
                childProcess.execFile('docker', ['kill', this.containerName]);
                this.showErrorBanner('The program exceeded its CPU quota.');
            }
        }, 1000);
    };

    private inspectAllThreads = async (): Promise<void> => {
        // We're about to momentarily interrupt any running threads so that we
        // can inspect them, and then immediately continue them once we're
        // done. This will trigger our gdb state change callbacks, but we don't
        // want to tell the client about these state changes, because we caused
        // them and are about to quickly change things around
        this.suppressDebuggerUpdates = true;

        // TODO: this is a blatant race condition, but somehow, we need to wait until the inferior
        // is up and running before doing this (otherwise, we risk sending SIGSTOP to a process that
        // is about to stop anyways because it hit a breakpoint, and then we get into a funky state
        // where we send SIGCONT thinking it stopped because we stopped it, but that ends up
        // resuming it from where the breakpoint was). A more robust solution should look at *why*
        // the child stopped and proceed here only if it really stopped because of the signal we
        // sent, but I need to think more about how to do that
        if (this.debuggerInitializationFinishedAt
            && Date.now() - this.debuggerInitializationFinishedAt > 2000) {
            // Add extra info to processes/threads, momentarily pausing threads as necessary to run
            // gdb inspection commands on them
            /* eslint-disable no-await-in-loop */
            for (const thread of Object.values(this.threads)) {
                try {
                    let shouldResumeThread = false;
                    console.debug(`${this.logPrefix}Inspecting thread`, thread);
                    if (thread.status === 'running') {
                        // Stop the thread to see where it currently is
                        console.debug(`${this.logPrefix}Stopping thread ${thread.id} to get stack info...`);
                        const stopEvent = await this.stopThread(thread);
                        // Only resume the thread if it stopped because of our signal. (It could
                        // have just run into a breakpoint before our interrupt came in, and we
                        // don't want to resume from there.)
                        shouldResumeThread = stopEvent.type === 'stopped' && stopEvent.stopSig === '0';
                    }

                    // Get information about the inferior while it's stopped
                    console.debug(`${this.logPrefix}Getting stack for thread ${thread.id}...`);
                    const stack = await this.gdb.callstack(thread);

                    if (shouldResumeThread) {
                        console.debug(`${this.logPrefix}Continuing thread ${thread.id}...`);
                        await this.continueThread(
                            thread, this.lastRunGdbContinueFunction[thread.id] || this.gdb.proceed,
                        );
                    }

                    // Update the `frame` property of the thread based on the stack that we pulled.
                    // We wait until *after* we've already continued the thread, because the gdb
                    // "run" event handler resets the `frame` of the thread to `null`, which is
                    // usually good, but we want to keep the frame info we pulled earlier.
                    // TODO: startsWith /cplayground/code is too brittle
                    const framesInUserCode = stack.filter(
                        (frame) => frame.file && frame.file.startsWith('/cplayground/code'),
                    );
                    if (framesInUserCode.length > 0) {
                        thread.frame = framesInUserCode[0];
                    }
                    console.debug(`${this.logPrefix}Finished inspecting thread ${thread.id}`);
                } catch (e) {
                    console.error(`${this.logPrefix}Error while trying to inspect thread`, thread, e);
                }
            }
            /* eslint-enable no-await-in-loop */
        }

        // All done, we can report back to the client now!
        this.suppressDebuggerUpdates = false;
    }

    private reportDebugInfo = async (): Promise<void> => {
        if (!this.containerId) {
            // If the container ID hasn't been set yet, there isn't much we can do
            return;
        }
        if (!this.containerPid) {
            await this.setContainerPid();
        }
        if (this.suppressDebuggerUpdates) {
            console.log(`${this.logPrefix}Debugger updates suppressed, bailing out of reportDebugInfo`);
            return;
        }

        await this.inspectAllThreads();

        const info = await debugging.getContainerInfo(
            this.containerPid, Object.values(this.processes), Object.values(this.threads),
        );
        if (info) {
            this.externalDebugCallback(info);
        } else {
            console.warn(
                `${this.logPrefix}Container is running but has no debugging info available`,
            );
        }
    };

    private stopThread = async (thread: Thread): Promise<ThreadEvent> => {
        if (this.threadStoppedCallbacks[thread.id] === undefined) {
            this.threadStoppedCallbacks[thread.id] = [];
        }
        const promise = new Promise<ThreadEvent>((resolve) => {
            this.threadStoppedCallbacks[thread.id].push(resolve);
        });
        await this.gdb.interrupt(thread);
        return promise;
    }

    private continueThread = async (
        thread: Thread,
        continueFunc: (thread: Thread) => unknown,
    ): Promise<ThreadEvent> => {
        if (this.threadContinuedCallbacks[thread.id] === undefined) {
            this.threadContinuedCallbacks[thread.id] = [];
        }
        const promise = new Promise<ThreadEvent>((resolve) => {
            this.threadContinuedCallbacks[thread.id].push(resolve);
        });
        await continueFunc.bind(this.gdb)(thread);
        return promise;
    }

    private setDebuggingMonitor = (): void => {
        // If there is already a timer running, stop it so we can reset it
        if (this.debuggingMonitor !== null) {
            clearInterval(this.debuggingMonitor);
        }
        // If the container already finished running, no reason to start another timer
        if (this.exited) {
            return;
        }
        // Every second, get info about the container's processes and send to the client.
        this.debuggingMonitor = setInterval(this.reportDebugInfo, 1000);
    };

    onInput = (data: string): void => {
        // Reset the timeout monitor. (We extend the timeout on input for people testing things
        // like games or shells.)
        this.setRunTimeoutMonitor();
        // Send input to container
        if (this.pty) {
            this.pty.write(data);
        }
    };

    resize = (rows: number, cols: number): void => {
        if (this.pty) {
            this.pty.resize(cols, rows);
        }
    };

    shutdown = (): void => {
        console.log(`${this.logPrefix}Stopping container...`);
        childProcess.execFile('docker', ['stop', '-t', '2', this.containerName], {},
            () => childProcess.execFile('docker', ['rm', this.containerName]));
    };

    gdbSetBreakpoint = async (line: number): Promise<void> => {
        if (!this.gdbSocketPath) {
            throw new DebugStateError('Debugging is not enabled');
        }
        console.log(`${this.logPrefix} got debugging command: set breakpoint`, line);
        const breakpoint = await this.gdb.addBreak(this.codeContainerPath, line);
        this.breakpoints[line] = breakpoint;

        // Extend run timeout for people in debugging sessions
        this.setRunTimeoutMonitor();
    };

    gdbRemoveBreakpoint = async (line: number): Promise<void> => {
        if (!this.gdbSocketPath) {
            throw new DebugStateError('Debugging is not enabled');
        }
        if (this.breakpoints[line] === undefined) {
            throw new DebugStateError(`No known breakpoint at ${line}`);
        }
        console.log(`${this.logPrefix} got debugging command: remove breakpoint`, line);
        await this.gdb.removeBreak(this.breakpoints[line]);
        delete this.breakpoints[line];

        // Extend run timeout for people in debugging sessions
        this.setRunTimeoutMonitor();
    };

    gdbProceed = async (threadId: number): Promise<void> => {
        if (!this.gdbSocketPath) {
            throw new DebugStateError('Debugging is not enabled');
        }
        if (this.threads[threadId] === undefined) {
            throw new DebugStateError(`No known thread with id ${threadId}`);
        }
        console.log(`${this.logPrefix} got debugging command: proceed`, threadId);
        await this.gdb.proceed(this.threads[threadId]);
        this.lastRunGdbContinueFunction[threadId] = this.gdb.proceed;

        // Extend run timeout for people in debugging sessions
        this.setRunTimeoutMonitor();
    };

    gdbStepIn = async (threadId: number): Promise<void> => {
        if (!this.gdbSocketPath) {
            throw new DebugStateError('Debugging is not enabled');
        }
        if (this.threads[threadId] === undefined) {
            throw new DebugStateError(`No known thread with id ${threadId}`);
        }
        console.log(`${this.logPrefix} got debugging command: step in`, threadId);
        await this.gdb.stepIn(this.threads[threadId]);
        this.lastRunGdbContinueFunction[threadId] = this.gdb.stepIn;

        // Extend run timeout for people in debugging sessions
        this.setRunTimeoutMonitor();
    };

    gdbNext = async (threadId: number): Promise<void> => {
        if (!this.gdbSocketPath) {
            throw new DebugStateError('Debugging is not enabled');
        }
        if (this.threads[threadId] === undefined) {
            throw new DebugStateError(`No known thread with id ${threadId}`);
        }
        console.log(`${this.logPrefix} got debugging command: next`, threadId);
        const nextLine = `${this.threads[threadId].frame.file}:${this.threads[threadId].frame.line + 1}`;
        await this.gdb.next(this.threads[threadId]);
        this.lastRunGdbContinueFunction[threadId] = async (thread: Thread): Promise<void> => {
            await this.gdb.execMI(`-exec-until ${nextLine}`, thread);
        };

        // Extend run timeout for people in debugging sessions
        this.setRunTimeoutMonitor();
    };

    sendSignal = async (inferiorId: number, signal: Signal): Promise<void> => {
        if (!this.gdbSocketPath) {
            throw new DebugStateError('Debugging is not enabled');
        }
        if (this.processes[inferiorId] === undefined) {
            throw new DebugStateError(`No known process with inferior id ${inferiorId}`);
        }
        console.log(`${this.logPrefix} got debugging command: sendSignal`, { inferiorId, signal });
        const proc = this.processes[inferiorId];

        // GDB prevents some signals from being handled by the child (e.g.
        // SIGINT). We have to tell GDB to let this signal pass through, and to
        // not stop the child on receipt of the signal (e.g. SIGINT usually
        // *stops* the child instead of terminating, but we want whatever the
        // default behavior is).
        await this.gdb.execMI(`-interpreter-exec console "handle ${Signal[signal]} nostop pass"`, proc);

        // Run `kill` inside the container to send the signal. I don't love this -- it starts
        // another process in the container, which can show up in the debugger and be really
        // confusing -- but the GDB options for sending signals were pretty clunky when I tested
        // them (there's no way to just *send the signal right now* -- you can either enqueue the
        // signal for when the child resumes, which doesn't add it to the kernel pending set, or you
        // can send it now but also continue the child, which doesn't play nicely with
        // breakpoints... also the commands only work if the child is paused, which adds a lot of
        // synchronization complexity). A better option would be to run `kill` outside of the docker
        // container and send to the global namespace PID, but we need to add more code to get that
        // PID from the kernel module or from /proc.
        await new Promise<void>((resolve) => {
            const args = ['exec', this.containerName, 'kill', `-${Signal[signal]}`, `${proc.pid}`];
            childProcess.execFile('docker', args,
                (err, out) => {
                    if (err) throw err;
                    if (out) {
                        console.info(`${this.logPrefix}Output of docker ${args.join(' ')}`, out);
                    }
                    resolve();
                });
        });
    }
}

import * as path from 'path';
import * as fs from 'fs';
import * as childProcess from 'child_process';
import * as stringArgv from 'string-argv';
import uuidv4 from 'uuid/v4';
import * as ptylib from 'node-pty';

import * as db from './db';
import { Compiler } from '../common/constants';
import { IncludeFile } from '../common/communication';
import { getPathFromRoot } from './util';

// eslint-disable-next-line no-undef
import Timeout = NodeJS.Timeout;

// How long should a program run for?
const DEFAULT_TIMEOUT = 60000;
// A program's timeout timer can be reset by I/O (e.g. so that if you're testing
// a shell, it doesn't get killed after only a minute), but can't exceed this time
const HARD_TIMEOUT = 300000;
// Prevent forkbombs and bitcoin mining:
const MAX_CPU_TIME = 15000;

const OUTPUT_BUFFER_MAX_LEN = db.OUTPUT_MAX_LEN;

export type ContainerExitNotification = {
    runtimeMs: number;
    exitStatus: number;
    signal: number;
    output: string;
}

export default class Container {
    private readonly logPrefix: string;

    private readonly containerName = uuidv4();
    private containerId: string | null = null;
    private readonly startTime = process.hrtime();
    private readonly pty: ptylib.IPty;

    private readonly dataHostPath = getPathFromRoot('data');
    private readonly codeHostPath = path.join(this.dataHostPath, this.containerName);
    private readonly includeFileHostPath = path.join(this.dataHostPath, `${this.containerName}-include.zip`);

    private readonly externalOutputCallback: (data: string) => void;
    private readonly externalExitCallback: (data: ContainerExitNotification) => void;

    private runTimeoutTimer: Timeout | null = null;
    private cpuQuotaMonitor: Timeout | null = null;

    // Save container output to a buffer that can later be committed to the database
    private outputBuf = '';
    private warnOutputMaxSizeExceeded = true;

    constructor(
        logPrefix: string,
        code: string,
        includeFile: IncludeFile,
        compiler: Compiler,
        cflags: string,
        argsStr: string,
        rows: number,
        cols: number,
        onOutput: (data: string) => void,
        onExit: (data: ContainerExitNotification) => void,
    ) {
        this.logPrefix = logPrefix;
        this.externalOutputCallback = onOutput;
        this.externalExitCallback = onExit;

        // Save the code to disk so that the files can be mounted into the container
        this.saveCodeFiles(code, includeFile);

        // Start the container
        // TODO: clean up container/files even if the server crashes
        const dockerRunArgs = this.generateDockerRunArgs(compiler, cflags, argsStr);
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
    }

    private saveCodeFiles = (code: string, includeFile: IncludeFile): void => {
        // Create data directory and save code from request
        console.log(`${this.logPrefix}Saving code to ${this.codeHostPath}`);
        if (!fs.existsSync(this.dataHostPath)) fs.mkdirSync(this.dataHostPath);
        fs.writeFileSync(this.codeHostPath, code);
        if (includeFile.name) {
            console.log(`Writing include file to ${this.includeFileHostPath}`);
            fs.writeFileSync(this.includeFileHostPath, includeFile.data);
        }
    };

    private generateDockerRunArgs = (
        compiler: Compiler, cflags: string, argsStr: string,
    ): string[] => {
        const fileExtension = compiler === 'gcc' ? '.c' : '.cpp';
        const codeContainerPath = `/cplayground/code${fileExtension}`;

        return ['run', '-it', '--name', this.containerName,
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
            '-v', `${this.codeHostPath}:${codeContainerPath}:ro`,
            '-v', `${this.includeFileHostPath}:/cplayground/include.zip:ro`,
            '-e', `COMPILER=${compiler}`,
            '-e', `CFLAGS=${cflags}`,
            '-e', `SRCPATH=${codeContainerPath}`,
            // Set more resource limits and disable networking
            '--memory', '96mb',
            '--memory-swap', '128mb',
            '--memory-reservation', '32mb',
            '--cpu-shares', '512',
            '--pids-limit', '16',
            '--ulimit', 'cpu=10:11',
            '--ulimit', 'nofile=64',
            '--network', 'none',
            'cplayground', '/run.sh',
        ].concat(
            // Safely parse argument string from user
            stringArgv.parseArgsStringToArgv(argsStr),
        );
    };

    private trySettingContainerId = (): void => {
        childProcess.execFile('docker',
            ['ps', '--no-trunc', '-aqf', `name=${this.containerName}`],
            (err, out) => {
                if (err) throw err;
                this.containerId = out.trim();
                console.log(`${this.logPrefix}Container id: ${this.containerId}`);
            });
    };

    private onOutput = (data: string): void => {
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
        const runtime = this.getContainerRunTimeMs();
        console.info(`${this.logPrefix}Container exited! Status ${exitCode}, signal ${signal}, `
            + `node-side runtime measured at ${runtime}ms`);

        clearTimeout(this.runTimeoutTimer);
        clearInterval(this.cpuQuotaMonitor);
        // Remove uploaded file. We don't care about errors, in case the file
        // was already removed (or was never successfully created to begin
        // with)
        try { fs.unlinkSync(this.codeHostPath); } catch { /* ignore */ }
        try { fs.unlinkSync(this.includeFileHostPath); } catch { /* ignore */ }

        this.externalExitCallback({
            runtimeMs: runtime,
            exitStatus: exitCode,
            signal,
            output: this.outputBuf,
        });
    };

    private showErrorBanner = (text: string): void => {
        // Note: if you modify these constants, be sure to update run.sh to
        // match
        const fg = '\x1b[91m'; // red
        const bg = '\x1b[100m'; // light gray
        const bannerWidth = 60;

        const lpad = ' '.repeat(Math.floor((bannerWidth - text.length) / 2));
        const rpad = ' '.repeat(Math.ceil((bannerWidth - text.length) / 2));
        this.externalOutputCallback(`${fg + bg + lpad + text + rpad}\x1b[0m`);
    };

    private getContainerRunTimeMs = (): number => {
        const runtimeHt = process.hrtime(this.startTime);
        return runtimeHt[0] * 1000 + runtimeHt[1] / 1000000;
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

    onInput = (data: string): void => {
        // Reset the timeout monitor. (We extend the timeout on input for people testing things
        // like games or shells.)
        this.setRunTimeoutMonitor();
        // Send input to container
        this.pty.write(data);
    };

    resize = (rows: number, cols: number): void => {
        this.pty.resize(cols, rows);
    };

    shutdown = (): void => {
        console.log(`${this.logPrefix}Stopping container...`);
        childProcess.execFile('docker', ['stop', '-t', '2', this.containerName], {},
            () => childProcess.execFile('docker', ['rm', this.containerName]));
    };
}

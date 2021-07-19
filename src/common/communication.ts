import { CompilerFlag, SupportedVersion } from './constants';

export type SavedProgram = {
    code: string;
    runtimeArgs: string;
    includeFileId: string | null;
    includeFileName: string | null;
    language: SupportedVersion;
    flags: CompilerFlag[];
}

export enum ProcessRunState {
    Running = 'R',
    Sleeping = 'S',
    IOSleeping = 'D',
    Stopped = 'T',
    TraceStopped = 't',
    Dead = 'X',
    Zombie = 'Z',
    Parked = 'P',
    Idle = 'I'
}

export enum Signal {
    SIGHUP = 1,
    SIGINT = 2,
    SIGQUIT = 3,
    SIGILL = 4,
    SIGTRAP = 5,
    SIGABRT = 6,
    SIGBUS = 7,
    SIGFPE = 8,
    SIGKILL = 9,
    SIGUSR1 = 10,
    SIGSEGV = 11,
    SIGUSR2 = 12,
    SIGPIPE = 13,
    SIGALRM = 14,
    SIGTERM = 15,
    SIGSTKFLT = 16,
    SIGCHLD = 17,
    SIGCONT = 18,
    SIGSTOP = 19,
    SIGTSTP = 20,
    SIGTTIN = 21,
    SIGTTOU = 22,
    SIGURG = 23,
    SIGXCPU = 24,
    SIGXFSZ = 25,
    SIGVTALRM = 26,
    SIGPROF = 27,
    SIGWINCH = 28,
    SIGIO = 29,
    SIGPWR = 30,
    SIGSYS = 31,
}

export type Process = {
    debuggerId: number | null;
    pid: number;
    ppid: number;
    pgid: number;
    command: string;
    runState: ProcessRunState;
    blockedSignals: Signal[];
    pendingSignals: Signal[];
    threads: Thread[];
    fds: FileDescriptorTable;
}

export type Thread = {
    debuggerId: number;
    status: 'running' | 'stopped' | 'terminated' | null;
    currentLine: number | null;
}

export type FileDescriptorTable = {
    [key: string]: {
        file: string;
        closeOnExec: boolean;
    };
}

export type OpenFileEntry = {
    position: number;
    flags: string[];
    refcount: number;
    vnode: string;
}

export type OpenFileTable = {
    [openFileId: string]: OpenFileEntry;
}

export type VNode = {
    name: string;
    refcount: number;
}

export type VnodeTable = {
    [fileId: string]: VNode;
}

export type ContainerInfo = {
    processes: Process[];
    openFiles: OpenFileTable;
    vnodes: VnodeTable;
}

export type RunEventBody = {
    code: string;
    language: string;
    flags: string[];
    args: string;
    includeFileId: string | null;
    rows: number;
    cols: number;
    debug: boolean;
    breakpoints?: number[];
}

export type ResizeEventBody = {
    rows: number;
    cols: number;
}

export type DebugSetBreakpointBody = {
    line: number;
}

export type DebugRemoveBreakpointBody = {
    line: number;
}

export type DebugProceedBody = {
    threadId: number;
}

export type DebugStepInBody = {
    threadId: number;
}

export type DebugNextBody = {
    threadId: number;
}

export type DebugSendSignal = {
    debuggerId: number;
    signal: Signal;
}

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

export type Process = {
    debuggerId: number | null;
    pid: number;
    ppid: number;
    pgid: number;
    command: string;
    runState: ProcessRunState;
    threads: Thread[];
    fds: FileDescriptorTable;
}

export type Thread = {
    debuggerId: number;
    status: 'running' | 'stopped' | 'terminated' | null;
    stoppedAt: number | null;
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

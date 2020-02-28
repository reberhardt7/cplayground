import { CompilerFlag, SupportedVersion } from './constants';

export type SavedProgram = {
    code: string;
    runtimeArgs: string;
    includeFileId: string | null;
    includeFileName: string | null;
    language: SupportedVersion;
    flags: CompilerFlag[];
}

export type Process = {
    pid: number;
    ppid: number;
    pgid: number;
    command: string;
    fds: FileDescriptorTable;
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
}

export type ResizeEventBody = {
    rows: number;
    cols: number;
}

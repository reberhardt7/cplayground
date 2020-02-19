import { CompilerFlag, SupportedVersion } from './constants';

export type SavedProgram = {
    code: string;
    runtimeArgs: string;
    includeFileName: string;
    includeFileData: Buffer;
    language: SupportedVersion;
    flags: CompilerFlag[];
}

export type IncludeFile = {
    name: string;
    data?: Buffer;
}

export type RunEventBody = {
    code: string;
    language: string;
    flags: string[];
    args: string;
    includeFile: {
        name: string;
        data: Buffer;
    };
    rows: number;
    cols: number;
}

export type ResizeEventBody = {
    rows: number;
    cols: number;
}

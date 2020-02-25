import { CompilerFlag, SupportedVersion } from './constants';

export type SavedProgram = {
    code: string;
    runtimeArgs: string;
    includeFileId: string | null;
    includeFileName: string | null;
    language: SupportedVersion;
    flags: CompilerFlag[];
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

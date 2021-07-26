import * as fs from 'fs';
import * as stringArgv from 'string-argv';
import { Request, Response } from 'express';

import * as db from './db';
import { SavedProgram } from '../common/communication';
import {
    SUPPORTED_VERSIONS,
    SupportedVersion,
    DEFAULT_VERSION,
    Compiler,
    CompilerFlag,
    DEFAULT_COMPILER,
    COMPILERS,
} from '../common/constants';
import { getPathFromRoot, getSourceIpFromRequest } from './util';
import { ClientValidationError } from './error';

function generateProgramJson(
    code: string, runtimeArgs: string, includeFileId: string, includeFileName: string,
    language: SupportedVersion, compiler: Compiler, flags: CompilerFlag[],
): SavedProgram {
    return {
        code, runtimeArgs, includeFileId, includeFileName, language, compiler, flags,
    };
}

const DEFAULT_CODE = fs.readFileSync(getPathFromRoot('src/server/default-code.cpp')).toString().trim();
const DEFAULT_PROGRAM_JSON = generateProgramJson(
    DEFAULT_CODE, '', null, null, DEFAULT_VERSION, DEFAULT_COMPILER,
    ['-O0', '-Wall', '-no-pie', '-lm', '-pthread'],
);

export function getProgram(req: Request, res: Response): void {
    console.info(`Incoming request for ${req.originalUrl}`);
    const progId = Array.isArray(req.query.p) ? req.query.p[0] : req.query.p;
    if (!progId || typeof progId !== 'string') {
        res.send(DEFAULT_PROGRAM_JSON);
    } else {
        db.getProgramByAlias(progId).then((result) => {
            if (result) {
                console.log(`Returning program ${result.id}`);
                const sourceIP = getSourceIpFromRequest(req);
                const sourceUA = req.headers['user-agent'] || '';
                db.logView(result.id, sourceIP, sourceUA);
                const includeFileId = result.include_file_id || null;
                const includeFileName = result.include_file_id && result.include_file_name;
                const langMatch = /-std=([A-Za-z0-9+]+)/.exec(result.cflags);
                const parsedLang = langMatch ? langMatch[1].toUpperCase() : DEFAULT_VERSION;
                const lang = SUPPORTED_VERSIONS.includes(parsedLang)
                    ? (parsedLang as SupportedVersion)
                    : DEFAULT_VERSION;
                const compiler = COMPILERS.includes(result.compiler)
                    ? (result.compiler as Compiler)
                    : DEFAULT_COMPILER;
                res.send(generateProgramJson(
                    result.code, result.args, includeFileId, includeFileName, lang,
                    compiler, stringArgv.parseArgsStringToArgv(result.cflags) as CompilerFlag[],
                ));
            } else {
                console.info('Program not found, sending default!');
                // TODO: send redirect to /
                res.send(DEFAULT_PROGRAM_JSON);
            }
        });
    }
}

function validateFile(file: Express.Multer.File): void {
    if (!file) {
        throw new ClientValidationError('File is missing from request!');
    }
    if (!file.originalname) {
        throw new ClientValidationError('File is missing filename!');
    }
    if (file.originalname.length > db.INCLUDE_FILE_NAME_MAX_LEN) {
        throw new ClientValidationError('Include file name exceeds max length!');
    }
    if (file.buffer.length > db.INCLUDE_FILE_DATA_MAX_LEN) {
        throw new ClientValidationError('Include file data exceeds max size!');
    }
}

export function uploadFile(req: Request, res: Response): void {
    console.info(`Incoming request for ${req.originalUrl}`);
    try {
        validateFile(req.file);
    } catch (e) {
        if (e instanceof ClientValidationError) {
            console.info(e.message);
            res.sendStatus(400);
            res.send({ status: 400, error: e.message });
            return;
        }
        throw e;
    }

    console.info(`Filename ${req.file.originalname}, length ${req.file.buffer.length}`);

    db.insertFile(
        req.file.originalname, req.file.buffer, getSourceIpFromRequest(req),
    ).then((id: string) => {
        res.send({
            status: 200,
            id,
        });
    });
}

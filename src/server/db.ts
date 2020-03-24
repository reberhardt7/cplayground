import * as mysql from 'mysql';
import * as process from 'process';
import * as url from 'url';
import * as crypto from 'crypto';
import * as fs from 'fs';

import { getPathFromRoot } from './util';

const ANIMALS = fs.readFileSync(getPathFromRoot('src/server/animals.txt'))
    .toString().split('\n').filter((str) => str.length > 0);

export const CODE_MAX_LEN = 65535; // TEXT
export const OUTPUT_MAX_LEN = 16777215; // MEDIUMBLOB
export const CFLAGS_MAX_LEN = 100;
export const ARGS_MAX_LEN = 100;
export const INCLUDE_FILE_NAME_MAX_LEN = 40;
export const INCLUDE_FILE_DATA_MAX_LEN = 10 ** 6; // be sure to update this client-side too

export type ProgramRecord = {
    id: number;
    hash: string;
    alias: string;
    created: Date;
    // eslint-disable-next-line camelcase
    source_ip: string;
    // eslint-disable-next-line camelcase
    source_user_agent: string;
    compiler: string;
    cflags: string;
    code: string;
    args: string | null;
    // eslint-disable-next-line camelcase
    include_file_id: string | null;
    // eslint-disable-next-line camelcase
    include_file_name: string | null;
}

if (!process.env.DB_URL) {
    console.error('Error! Must specify DB_URL enviroment variable');
    process.exit(1);
}

const dbUrl = new url.URL(process.env.DB_URL);

if (!dbUrl.host || !dbUrl.username || !dbUrl.password) {
    console.error('Please specify host, user, and password in DB_URL');
    process.exit(1);
}

// Note: be sure to update migrations.js as well!
const pool = mysql.createPool({
    connectionLimit: 20,
    host: dbUrl.host,
    user: dbUrl.username,
    password: dbUrl.password,
    database: 'cplayground',
});

function hashProgram(
    compiler: string,
    cflags: string,
    code: string,
    args: string,
    includeFileId: string,
): string {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify({
        compiler, cflags, code, args, includeFileId,
    }));
    return hash.digest('base64');
}

function getProgram(
    compiler: string,
    cflags: string,
    code: string,
    args: string,
    includeFileId: string,
): Promise<ProgramRecord | null> {
    const hash = hashProgram(compiler, cflags, code, args, includeFileId);
    return new Promise((resolve) => {
        pool.query(`
            SELECT programs.*, files.name AS include_file_name
            FROM programs
            LEFT JOIN files ON programs.include_file_id = files.id
            WHERE programs.hash = ?
        `, hash, (err, res) => {
            if (err) throw err;
            else if (res && res.length > 0) {
                const row = res[0];
                resolve({
                    ...row,
                    // eslint-disable-next-line @typescript-eslint/camelcase
                    include_file_id: row.include_file_id && row.include_file_id.toString('hex'),
                });
            } else {
                resolve(null);
            }
        });
    });
}

export function getProgramByAlias(alias: string): Promise<ProgramRecord | null> {
    return new Promise((resolve) => {
        pool.query(`
            SELECT programs.*, files.name AS include_file_name
            FROM programs
            LEFT JOIN files ON programs.include_file_id = files.id
            WHERE alias = ?
        `, alias, (err, res) => {
            if (err) throw err;
            else if (res && res.length > 0) {
                const row = res[0];
                resolve({
                    ...row,
                    // eslint-disable-next-line @typescript-eslint/camelcase
                    include_file_id: row.include_file_id && row.include_file_id.toString('hex'),
                });
            } else {
                resolve(null);
            }
        });
    });
}

export function insertProgram(
    compiler: string,
    cflags: string,
    code: string,
    args: string,
    includeFileId: string,
    sourceIp: string,
    sourceUserAgent: string,
): Promise<{id: number; alias: string}> {
    // When storing a program, we generate a SHA-256 hash of all the parameters the client sent
    // us. The chance of a collision is extremely low, and this allows us to not add duplicate
    // entries in the database if someone were to run the same code several times. Because a
    // long hash doesn't make for a good URL for a program, we also generate a unique "alias"
    // containing 3 names of animals. This is what is shown to users (the hash and
    // auto-incrementing ID are never shown).
    const hash = hashProgram(compiler, cflags, code, args, includeFileId);
    return new Promise((resolve) => {
        function tryInsert(): void {
            // Try generating an alias and insert into it into the database. If
            // it's already taken, we'll generate a new one later.
            const alias = Array.from({ length: 3 },
                () => ANIMALS[Math.floor(Math.random() * ANIMALS.length)]).join('-');
            pool.query(
                'INSERT INTO programs SET ?',
                {
                    hash,
                    alias,
                    compiler,
                    cflags,
                    code,
                    args,
                    // eslint-disable-next-line @typescript-eslint/camelcase
                    include_file_id: includeFileId && Buffer.from(includeFileId, 'hex'),
                    // eslint-disable-next-line @typescript-eslint/camelcase
                    source_ip: sourceIp,
                    // eslint-disable-next-line @typescript-eslint/camelcase
                    source_user_agent: sourceUserAgent,
                },
                (error, res) => {
                    if (error && error.sqlMessage.startsWith('Duplicate entry')
                        && error.sqlMessage.endsWith('alias\'')) {
                        // If alias is already taken, try a new one
                        tryInsert();
                    } else if (error && error.sqlMessage.startsWith('Duplicate entry')
                        && error.sqlMessage.endsWith('hash\'')) {
                        // Return the existing program info
                        resolve(getProgram(compiler, cflags, code, args, includeFileId));
                    } else if (error) {
                        console.error('Error inserting program!');
                        console.error(error);
                    } else {
                        resolve({ id: res.insertId, alias });
                    }
                },
            );
        }
        tryInsert();
    });
}

export function createRun(
    programId: number, sourceIp: string, sourceUserAgent: string,
): Promise<number> {
    return new Promise((resolve) => {
        pool.query('INSERT INTO runs SET ?', {
            // eslint-disable-next-line @typescript-eslint/camelcase
            program_id: programId,
            // eslint-disable-next-line @typescript-eslint/camelcase
            source_ip: sourceIp,
            // eslint-disable-next-line @typescript-eslint/camelcase
            source_user_agent: sourceUserAgent,
        }, (err, res) => {
            if (err) throw err;
            resolve(res.insertId);
        });
    });
}

export function updateRun(
    id: number, runtimeMs: number, exitStatus: number, output: string,
): Promise<void> {
    return new Promise((resolve) => {
        pool.query('UPDATE runs SET ? WHERE id = ?',
            // eslint-disable-next-line @typescript-eslint/camelcase
            [{ runtime_ms: runtimeMs, exit_status: exitStatus, output }, id],
            (err, res) => {
                if (err) throw err;
                if (res.affectedRows !== 1) {
                    console.error(
                        'updateRun expected 1 run to be updated, but none were!',
                        { id, runtimeMs, exitStatus, output },
                    );
                }
                resolve();
            });
    });
}

export function logView(
    programId: number, sourceIp: string, sourceUserAgent: string,
): Promise<number> {
    return new Promise((resolve) => {
        pool.query('INSERT INTO views SET ?', {
            // eslint-disable-next-line @typescript-eslint/camelcase
            program_id: programId,
            // eslint-disable-next-line @typescript-eslint/camelcase
            source_ip: sourceIp,
            // eslint-disable-next-line @typescript-eslint/camelcase
            source_user_agent: sourceUserAgent,
        }, (err, res) => {
            if (err) throw err;
            resolve(res.insertId);
        });
    });
}

function getFileId(name: string, contents: Buffer): Promise<string> {
    return new Promise((resolve) => {
        pool.query('SELECT id FROM files WHERE name = ? AND contents = ?', [name, contents],
            (err, res) => {
                if (err) throw err;
                else if (res && res.length) resolve((res[0].id as Buffer).toString('hex'));
                else resolve(null);
            });
    });
}

export function insertFile(name: string, contents: Buffer, sourceIp: string): Promise<string> {
    return new Promise((resolve) => {
        pool.query(`
            INSERT INTO files (id, name, contents, source_ip)
            SELECT UNHEX(SHA2(CONCAT(name, ':', contents), 224)), name, contents, source_ip
            FROM (SELECT ? AS name, ? AS contents, ? AS source_ip) AS vals
        `,
        [name, contents, sourceIp],
        (error, result) => {
            if (error && error.sqlMessage.startsWith('Duplicate entry')) {
                // If the file already exists, let's use the existing ID
                resolve(getFileId(name, contents));
            } else if (error) {
                console.error('Error inserting file!');
                console.error(error);
                throw error;
            } else {
                resolve(result.insertId.toString('hex'));
            }
        });
    });
}

export function getFileContents(id: string): Promise<Buffer | null> {
    const binaryId = Buffer.from(id, 'hex');
    if (binaryId.length !== 28) { // Length of binary id column in the database
        // This can't possibly be a valid ID
        console.warn('getFileContents was called with an invalid ID', id);
        return Promise.resolve(null);
    }
    return new Promise((resolve) => {
        pool.query('SELECT contents FROM files WHERE id = ?', [binaryId], (err, res) => {
            if (err) throw err;
            else if (res && res.length) resolve(res[0].contents);
            else resolve(null);
        });
    });
}

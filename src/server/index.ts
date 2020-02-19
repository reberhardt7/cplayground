import * as fs from 'fs';
import * as stringArgv from 'string-argv';
import express, { Request, Response } from 'express';
import http from 'http';
import socketio from 'socket.io';
import consoleStamp from 'console-stamp';

import * as db from './db';
import { SavedProgram } from '../common/communication';
import {
    SUPPORTED_VERSIONS,
    SupportedVersion,
    DEFAULT_VERSION,
    CompilerFlag,
    THEMES,
} from '../common/constants';
import SocketConnection from './socket-connection';
import { getPathFromRoot, getSourceIpFromRequest } from './util';

const app = express();
const server = new http.Server(app);
const io = socketio(server);

const port = process.env.PORT || 3000;

// Add timestamps to log messages
consoleStamp(console, { pattern: 'isoDateTime' });

const INDEX_HTML_CODE = fs.readFileSync(getPathFromRoot('src/client/index.html')).toString();

function generateIndexHtml(req: Request, res: Response): void {
    console.info(`Incoming request for ${req.originalUrl}`);
    const theme = THEMES.includes(req.query.theme) ? `theme-${req.query.theme}` : 'styles';
    res.send(INDEX_HTML_CODE.replace('{{THEME}}', theme));
}

function generateProgramJson(
    code: string, runtimeArgs: string, includeFileName: string, includeFileData: Buffer,
    language: SupportedVersion, flags: CompilerFlag[],
): SavedProgram {
    return {
        code, runtimeArgs, includeFileName, includeFileData, language, flags,
    };
}

const DEFAULT_CODE = fs.readFileSync(getPathFromRoot('src/server/default-code.cpp')).toString().trim();
const DEFAULT_PROGRAM_JSON = generateProgramJson(
    DEFAULT_CODE, '', null, null, DEFAULT_VERSION,
    ['-O2', '-Wall', '-no-pie', '-lm', '-pthread'],
);

function handleGetProgram(req: Request, res: Response): void {
    console.info(`Incoming request for ${req.originalUrl}`);
    if (!req.query.p) {
        res.send(DEFAULT_PROGRAM_JSON);
    } else {
        db.getProgramByAlias(req.query.p).then((result) => {
            if (result) {
                console.log(`Returning program ${result.id}`);
                const sourceIP = getSourceIpFromRequest(req);
                const sourceUA = req.headers['user-agent'] || '';
                db.logView(result.id, sourceIP, sourceUA);
                const includeFileName = result.include_file_name || null;
                const includeFileData = includeFileName && result.include_file_data;
                const langMatch = /-std=([A-Za-z0-9+]+)/.exec(result.cflags);
                const parsedLang = langMatch ? langMatch[1].toUpperCase() : DEFAULT_VERSION;
                const lang = SUPPORTED_VERSIONS.includes(parsedLang)
                    ? (parsedLang as SupportedVersion)
                    : DEFAULT_VERSION;
                res.send(generateProgramJson(
                    result.code, result.args, includeFileName, includeFileData,
                    lang, stringArgv.parseArgsStringToArgv(result.cflags) as CompilerFlag[],
                ));
            } else {
                console.info('Program not found, sending default!');
                // TODO: send redirect to /
                res.send(DEFAULT_PROGRAM_JSON);
            }
        });
    }
}

function addExpressRoutes(): void {
    app.disable('x-powered-by');
    app.get('/((embed)?)',
        (req, res) => generateIndexHtml(req, res));
    app.get('/api/getProgram',
        (req, res) => handleGetProgram(req, res));
    app.get('/styles.css', (req, res) => {
        res.sendFile(getPathFromRoot('dist/client/css/styles.css'));
    });
    for (const theme of THEMES) {
        app.get(`/theme-${theme}.css`, (req, res) => {
            res.sendFile(getPathFromRoot(`dist/client/css/theme-${theme}.css`));
        });
    }
    app.get('/app.js', (req, res) => {
        res.sendFile(getPathFromRoot('dist/client/bundle.js'));
    });
    app.get('/bundle.js.map', (req, res) => {
        res.sendFile(getPathFromRoot('dist/client/bundle.js.map'));
    });
    app.get('/ace-builds/src-noconflict/ace.js', (req, res) => {
        res.sendFile(getPathFromRoot('node_modules/ace-builds/src-noconflict/ace.js'));
    });
    app.get('/ace-builds/src-noconflict/mode-c_cpp.js', (req, res) => {
        res.sendFile(getPathFromRoot('node_modules/ace-builds/src-noconflict/mode-c_cpp.js'));
    });
    app.get('/xterm.css', (req, res) => {
        res.sendFile(getPathFromRoot('node_modules/xterm/css/xterm.css'));
    });
}
addExpressRoutes();

io.on('connection', (socket) => new SocketConnection(socket, `[${socket.conn.id}] `));

server.listen(port, () => {
    console.log(`Server listening on *:${port}`);
});

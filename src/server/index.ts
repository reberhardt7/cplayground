import * as fs from 'fs';
import express, { Request, Response } from 'express';
import multer from 'multer';
import http from 'http';
import socketio from 'socket.io';
import consoleStamp from 'console-stamp';
import sourceMap from 'source-map-support';

import {
    THEMES,
} from '../common/constants';
import SocketConnection from './socket-connection';
import { getPathFromRoot } from './util';
import * as httpApi from './http-api';
import * as debugging from './debugging';

// https://stackoverflow.com/a/43994921
sourceMap.install();
process.on('unhandledRejection', console.error);

const app = express();
const server = new http.Server(app);
const io = socketio(server);
const upload = multer();

const port = process.env.PORT || 3000;

// Add timestamps to log messages
consoleStamp(console, { pattern: 'isoDateTime' });

if (!debugging.ENABLE_DEBUGGING) {
    console.warn('Debugging is disabled (maybe because the kernel extension is not '
        + 'loaded). `debug` events will not be sent to the client.');
}

const INDEX_HTML_CODE = fs.readFileSync(getPathFromRoot('src/client/index.html')).toString();

function generateIndexHtml(req: Request, res: Response): void {
    console.info(`Incoming request for ${req.originalUrl}`);
    const themeName = Array.isArray(req.query.theme) ? req.query.theme[0] : req.query.theme;
    const theme = typeof themeName === 'string' && THEMES.includes(themeName)
        ? `theme-${req.query.theme}`
        : 'styles';
    res.send(INDEX_HTML_CODE.replace('{{THEME}}', theme));
}

// Unnecessary info leak:
app.disable('x-powered-by');

// Generate HTML for / and /embed:
app.get('/((embed)?)', generateIndexHtml);

// HTTP API routes:
app.get('/api/getProgram', httpApi.getProgram);
app.post('/api/files', upload.single('file'), httpApi.uploadFile);

// Static assets:
function addStaticHandler(urlPath: string, filePath: string): void {
    app.get(urlPath, (req, res) => {
        res.sendFile(getPathFromRoot(filePath));
    });
}
addStaticHandler('/styles.css', 'dist/client/css/styles.css');
for (const theme of THEMES) {
    addStaticHandler(`/theme-${theme}.css`, `dist/client/css/theme-${theme}.css`);
}
addStaticHandler('/app.js', 'dist/client/bundle.js');
addStaticHandler('/bundle.js.map', 'dist/client/bundle.js.map');
addStaticHandler('/ace-builds/src-noconflict/ace.js', 'node_modules/ace-builds/src-noconflict/ace.js');
addStaticHandler('/ace-builds/src-noconflict/mode-c_cpp.js', 'node_modules/ace-builds/src-noconflict/mode-c_cpp.js');
addStaticHandler('/xterm.css', 'node_modules/xterm/css/xterm.css');
addStaticHandler('/img/read-icon.png', 'src/client/img/read-icon.png');
addStaticHandler('/img/write-icon.png', 'src/client/img/write-icon.png');

// Handle websocket connections:
io.on('connection', (socket) => new SocketConnection(socket, `[${socket.conn.id}] `));

// Ready to roll -- start the server!
server.listen(port, () => {
    console.log(`Server listening on *:${port}`);
});

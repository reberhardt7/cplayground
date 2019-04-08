const path = require('path');
const child_process = require('child_process');
const ptylib = require('node-pty');
const uuidv4 = require('uuid/v4');
const fs = require('fs');
const stringArgv = require('string-argv');
const assert = require('assert');
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 3000;

// Add timestamps to log messages
require('console-stamp')(console, 'isoDateTime');

const db = require('./db');

const THEMES = ['zenburn'];

const SUPPORTED_VERSIONS = ['C99', 'C11', 'C++11', 'C++14', 'C++17'];
const WHITELISTED_CFLAGS = [
    '-O0', '-O1', '-O2', '-O3',
    '-Wall',
    '-no-pie',
    '-fpie -Wl,-pie',   // ASLR
    '-fstack-protector-strong', // Anti stack smashing
    '-lm', '-pthread', '-lcrypt', '-lreadline', '-lrt'
];

function sanitizeHtml(str) {
    return (str.replace(/&/g, '&amp;')
               .replace(/"/g, '&quot;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;'));
}

const INDEX_HTML_CODE = fs.readFileSync(
    path.resolve(__dirname + '/../client/index.html')).toString();
const DEFAULT_CODE = fs.readFileSync(path.join(__dirname, 'default-code.cpp'))
    .toString().trim().replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
const DEFAULT_INDEX_HTML = INDEX_HTML_CODE
    .replace('{{INITIAL_CODE}}', DEFAULT_CODE)
    .replace('{{RUNTIME_ARGS}}', '')
    .replace('{{INCLUDE_FILE_NAME}}', '')
    .replace('{{INJECT_INCLUDE_FILE}}', '')
    .replace('{{THEME}}', 'styles');

const EMBED_HTML_CODE = fs.readFileSync(
    path.resolve(__dirname + '/../client/embed.html')).toString();
const DEFAULT_EMBED_HTML = EMBED_HTML_CODE
    .replace('{{INITIAL_CODE}}', DEFAULT_CODE)
    .replace('{{RUNTIME_ARGS}}', '')
    .replace('{{INCLUDE_FILE_NAME}}', '')
    .replace('{{INJECT_INCLUDE_FILE}}', '')
    .replace('{{THEME}}', 'styles');

function handleLoadProgram(req, res, defaultCode, templateCode) {
    console.info('Incoming request for ' + req.originalUrl);
    if (!req.query.p) {
        res.send(defaultCode);
    } else {
        db.getProgramByAlias(req.query.p).then(result => {
            if (result) {
                console.log('Returning program ' + result.id);
                const sourceIP = req.headers['cf-connecting-ip']
                    || req.headers['x-real-ip']
                    || req.connection.remoteAddress;
                const sourceUA = req.headers['user-agent'] || '';
                db.logView(result.id, sourceIP, sourceUA);
                const includeFileName = sanitizeHtml(result.include_file_name || '');
                const includeFileData = result.include_file_data.toString('base64');
                const includeFileInjectJs = result.include_file_name
                    ? `function _base64ToArrayBuffer(base64) {
                           const binary_string = window.atob(base64);
                           const bytes = new Uint8Array(binary_string.length);
                           for (let i = 0; i < binary_string.length; i++) {
                               bytes[i] = binary_string.charCodeAt(i);
                           }
                           return bytes.buffer;
                       }
                       window.includeFileFromServer = {name: "${includeFileName}",
                           data: _base64ToArrayBuffer("${includeFileData}")};`
                    : '';
                const theme = THEMES.includes(req.query.theme)
                    ? 'theme-' + req.query.theme
                    : 'styles';
                res.send(templateCode
                    .replace('{{RUNTIME_ARGS}}', sanitizeHtml(result.args))
                    .replace('{{INITIAL_CODE}}', sanitizeHtml(result.code))
                    .replace('{{INCLUDE_FILE_NAME}}', includeFileName)
                    .replace('{{INJECT_INCLUDE_FILE}}', includeFileInjectJs)
                    .replace('{{THEME}}', theme));
            } else {
                console.info('Program not found, sending default!');
                // TODO: send redirect to /
                res.send(defaultCode);
            }
        });
    }
}

app.get('/',
    (req, res) => handleLoadProgram(req, res, DEFAULT_INDEX_HTML, INDEX_HTML_CODE));
app.get('/embed',
    (req, res) => handleLoadProgram(req, res, DEFAULT_EMBED_HTML, EMBED_HTML_CODE));
app.get('/styles.css', function(req, res){
    res.sendFile(path.resolve(__dirname + '/../../dist/client/css/styles.css'));
});
for (let theme of THEMES) {
    app.get('/theme-' + theme + '.css', function(req, res){
        res.sendFile(path.resolve(__dirname + '/../../dist/client/css/theme-' + theme + '.css'));
    });
}
app.get('/app.js', function(req, res){
    res.sendFile(path.resolve(__dirname + '/../../dist/client/bundle.js'));
});
app.get('/ace-builds/src-noconflict/ace.js', function(req, res){
    res.sendFile(path.resolve(__dirname + '/../../node_modules/ace-builds/src-noconflict/ace.js'));
});
app.get('/ace-builds/src-noconflict/mode-c_cpp.js', function(req, res){
    res.sendFile(path.resolve(__dirname + '/../../node_modules/ace-builds/src-noconflict/mode-c_cpp.js'));
});
app.get('/xterm.css', function(req, res){
    res.sendFile(path.resolve(__dirname + '/../../node_modules/xterm/dist/xterm.css'));
});

function getRunParams(request) {
    const lang = SUPPORTED_VERSIONS.includes(request.language)
        ? request.language : 'C++17';
    const fileExt = ['C99', 'C11'].indexOf(lang) > -1
        ? '.c' : '.cpp';
    const compiler = ['C99', 'C11'].indexOf(lang) > -1
        ? 'gcc' : 'g++';

    const suppliedCflags = (request.flags || []).filter(
        flag => WHITELISTED_CFLAGS.includes(flag));
    if (suppliedCflags.length != (request.flags || []).length) {
        console.warn('Warning: someone passed non-whitelisted flags! '
            + request.flags);
    }
    const cflags = ('-std=' + lang.toLowerCase()
        + ' ' + suppliedCflags.join(' ')).trim();
    if (cflags.length > db.CFLAGS_MAX_LEN) {
        throw 'Submitted cflags exceeds max length!';
    }

    const code = request.code || '';
    if (code.length > db.CODE_MAX_LEN) {
        throw 'Submitted code exceeds max length!';
    }

    const argsStr = request.args || '';
    if (argsStr.length > db.ARGS_MAX_LEN) {
        throw 'Submitted args exceed max length!';
    }

    const requestIncludeFile = request.includeFile || {};
    const includeFile = {};
    includeFile.name = requestIncludeFile.name || '';
    includeFile.data = (requestIncludeFile.data instanceof Buffer)
        ? requestIncludeFile.data : Buffer.alloc(0);
    if (includeFile.name.length > db.INCLUDE_FILE_NAME_MAX_LEN) {
        throw 'Include file name exceeds max length!';
    }
    if (includeFile.data.length > db.INCLUDE_FILE_DATA_MAX_LEN) {
        throw 'Include file data exceeds max size!';
    }

    return { compiler, cflags, code, fileExt, argsStr, includeFile };
}

io.on('connection', function(socket){
    const sourceIP = socket.handshake.headers['cf-connecting-ip']
        || socket.handshake.headers['x-real-ip']
        || socket.conn.remoteAddress;
    const sourceUA = socket.handshake.headers['user-agent'] || '';
    const connIdPrefix = '[' + socket.conn.id + '] ';
    console.info(connIdPrefix + 'Websocket connection received from ' + sourceIP);

    let rows = parseInt(socket.handshake.query.rows, 10) || 80;
    let cols = parseInt(socket.handshake.query.cols, 10) || 80;
    let pty;
    const containerName = uuidv4();
    const dataPath = path.resolve(__dirname + '/../../data');
    const codePath = path.join(dataPath, containerName);
    const includeDataPath = path.join(dataPath, containerName + '-include.zip');

    function startContainer(compiler, cflags, containerCodePath, argsStr,
            exitCallback) {
        // TODO: clean up container/files even if the server crashes
        const args = ['run', '-it', '--name', containerName,
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
            '-v', `${codePath}:${containerCodePath}:ro`,
            '-v', `${includeDataPath}:/cplayground/include.zip:ro`,
            '-e', 'COMPILER=' + compiler,
            '-e', 'CFLAGS=' + cflags,
            '-e', 'SRCPATH=' + containerCodePath,
            // Set more resource limits and disable networking
            '--memory', '96mb',
            '--memory-swap', '128mb',
            '--memory-reservation', '32mb',
            '--cpu-shares', '512',
            '--pids-limit', '16',
            '--ulimit', 'cpu=10:11',
            '--ulimit', 'nofile=64',
            '--network', 'none',
            'cplayground', '/run.sh'
        ].concat(
            // Safely parse argument string from user
            stringArgv.parseArgsStringToArgv(argsStr)
        )

        console.log(connIdPrefix + 'Starting container: docker ' + args.join(' '));
        console.log(connIdPrefix + 'Terminal size ' + rows + 'x' + cols);
        pty = ptylib.spawn('docker', args, {
          name: 'xterm-color',
          cols: cols,
          rows: rows,
        });

        const startTime = process.hrtime();

        // Kill the container if it doesn't finish running within 90 seconds.
        // (There is already a 60-second timeout in run.sh, but this is here in
        // case the userspace timeout program is somehow circumvented within
        // the container.)
        const runTimeoutTimer = setTimeout(
            () => {
                console.warn(connIdPrefix + 'Container ' + containerName
                    + ' hasn\'t finished running in time! Killing container');
                child_process.execFile('docker', ['kill', containerName]);
            },
            90000);

        // Send process output to websocket, and save to a server buffer that
        // we can later log to the database
        let outputBuf = '';
        let warnOutputMaxSizeExceeded = true;
        pty.on('data', data => {
            if (!outputBuf) console.log(connIdPrefix
                + 'Data received from terminal output');
            if (outputBuf.length + data.length < db.OUTPUT_MAX_LEN) {
                outputBuf += data;
            } else if (warnOutputMaxSizeExceeded) {
                console.warn(connIdPrefix
                    + 'Program output exceeded max length for db storage!');
                warnOutputMaxSizeExceeded = false;
            }
            socket.emit('data', Buffer.from(data));
        });

        // Send input from websocket to process
        socket.on('data', data => {
            pty.write(data);
        });

        // Close the websocket when process exits
        pty.on('exit', (code, signal) => {
            const runtime_ht = process.hrtime(startTime);
            const runtime_ms = runtime_ht[0] * 1000 + runtime_ht[1] / 1000000;
            console.info(connIdPrefix + 'Container exited! Status ' + code
                + ', signal ' + signal + ', node-side runtime measured at '
                + runtime_ms + 'ms');
            clearTimeout(runTimeoutTimer);
            pty = null;
            if (socket.connected) {
                console.log(connIdPrefix + 'Sending client exit info');
                socket.emit('exit', {code, signal});
            }
            exitCallback({
                runtime_ms: runtime_ms,
                exit_status: code,
                output: outputBuf,
            });
            shutdown();
        });
    }

    function shutdown() {
        console.log(connIdPrefix + 'Stopping container and cleaning up...');
        child_process.execFile('docker', ['stop', containerName], {},
            () => child_process.execFile('docker', ['rm', containerName]));
        // force kill after 1 second
        setTimeout(() => {
            child_process.execFile('docker', ['kill', containerName], {},
                () => child_process.execFile('docker', ['rm', containerName]));
        }, 1000);

        // Remove uploaded file. We don't care about errors, in case the file
        // was already removed (or was never successfully created to begin
        // with)
        try { fs.unlinkSync(codePath); } catch {}
        try { fs.unlinkSync(includeDataPath); } catch {}

        if (socket.connected) {
            console.log(connIdPrefix + 'Closing socket');
            socket.disconnect();
        }
    }

    socket.on('run', cmdInfo => {
        if (pty) {
            console.warn(connIdPrefix + 'Got run command even though we '
                + 'already have a pty in use');
            return;
        }

        // Parse info from run request
        let compiler, cflags, code, fileExt, argsStr;
        try {
            ({ compiler, cflags, code, fileExt, argsStr, includeFile }
                = getRunParams(cmdInfo));
        } catch (e) {
            console.error(connIdPrefix + 'Failed to get valid run params!');
            console.error(e);
            // TODO: send client an explanation
            shutdown();
        }

        // Create data directory and save code from request
        const containerCodePath = '/cplayground/code' + fileExt;
        console.log(connIdPrefix + 'Saving code to ' + codePath);
        if (!fs.existsSync(dataPath)) fs.mkdirSync(dataPath);
        fs.writeFileSync(codePath, code);
        if (includeFile.name) {
            console.log('Writing include file to ' + includeDataPath);
            fs.writeFileSync(includeDataPath, includeFile.data);
        }

        // Log to db and start running the container
        let alias, runId;
        db.insertProgram(compiler, cflags, code, argsStr, includeFile, sourceIP, sourceUA).then(row => {
            alias = row.alias;
            console.log(connIdPrefix + 'Program is at alias ' + alias);
            return db.createRun(row.id, sourceIP, sourceUA);
        }).then(id => {
            runId = id;
            console.log(connIdPrefix + 'Run logged with ID ' + runId);
            socket.emit('saved', alias);
            return new Promise(resolve => {
                startContainer(compiler, cflags, containerCodePath, argsStr,
                    results => resolve(results));
            });
        }).then(results => {
            // When the container exits, log the running time and output
            db.updateRun(runId, results.runtime_ms, results.exit_status,
                results.output);
        });
    });

    socket.on('resize', data => {
        cols = data.cols;
        rows = data.rows;
        console.log(connIdPrefix + 'Resize info received: '
            + rows + 'x' + cols);
        if (pty) pty.resize(data.cols, data.rows);
    });

    socket.on('disconnect', function(){
        console.info(connIdPrefix + 'Client disconnected');
        shutdown();
    });
});

http.listen(port, function(){
    console.log('Server listening on *:' + port);
});

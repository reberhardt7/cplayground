const path = require('path');
const child_process = require('child_process');
const ptylib = require('node-pty');
const uuidv4 = require('uuid/v4');
const fs = require('fs');
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 3000;

const SUPPORTED_VERSIONS = ['C99', 'C11', 'C++11', 'C++14', 'C++17'];
const WHITELISTED_CFLAGS = [
    '-O0', '-O1', '-O2', '-O3',
    '-Wall',
    '-fpie -Wl,-pie',   // ASLR
    '-fstack-protector-strong', // Anti stack smashing
    '-lm', '-pthread', '-lcrypt', '-lrt'
];

app.get('/', function(req, res){
    res.sendFile(path.resolve(__dirname + '/../client/index.html'));
});
app.get('/styles.css', function(req, res){
    res.sendFile(path.resolve(__dirname + '/../client/styles.css'));
});
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

io.on('connection', function(socket){
    console.log('Connection received');
    let rows = parseInt(socket.handshake.query.rows, 10) || 80;
    let cols = parseInt(socket.handshake.query.cols, 10) || 80;
    let pty;
    const containerName = uuidv4();
    const dataPath = path.resolve(__dirname + '/../../data');
    const codePath = path.join(dataPath, containerName);

    function shutdown() {
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

        if (socket.connected) socket.disconnect();
    }

    socket.on('run', cmdInfo => {
        if (pty) {
            console.log('Warning: Got run command even though we '
                + 'already have a pty');
            return;
        }

        const lang = SUPPORTED_VERSIONS.includes(cmdInfo.language)
            ? cmdInfo.language : 'C++17';
        const extension = ['C99', 'C11'].indexOf(lang) > -1
            ? '.c' : '.cpp';
        const suppliedCflags = (cmdInfo.flags || []).filter(
            flag => WHITELISTED_CFLAGS.includes(flag));
        if (suppliedCflags.length != (cmdInfo.flags || []).length) {
            console.log('Warning: someone passed non-whitelisted flags! '
                + cmdInfo.flags);
        }

        // Create data directory and save code from request
        const containerCodePath = '/cppfiddle/code' + extension;
        if (!fs.existsSync(dataPath)) fs.mkdirSync(dataPath);
        fs.writeFileSync(codePath, cmdInfo.code);

        // Spawn pty/subprocess
        // TODO: clean up container/files even if the server crashes
        // TODO: deal with cppfiddle Docker image as part of build process
        const compiler = ['C99', 'C11'].indexOf(lang) > -1
            ? 'gcc' : 'g++';
        const cflags = ('-std=' + lang.toLowerCase()
            + ' ' + suppliedCflags.join(' ')).trim();
        const args = ['run', '-it', '--name', containerName,
            '-v', `${codePath}:${containerCodePath}:ro`,
            '-e', 'COMPILER=' + compiler,
            '-e', 'CFLAGS=' + cflags,
            '-e', 'SRCPATH=' + containerCodePath,
            '--memory', '96mb',
            '--memory-swap', '128mb',
            '--memory-reservation', '32mb',
            '--cpu-shares', '512',
            '--pids-limit', '16',
            '--ulimit', 'cpu=10:11',
            '--ulimit', 'nofile=64',
            // TODO: reinstate storage limits
            //'--storage-opt', 'size=8M',
            'cppfiddle', '/cppfiddle/run.sh']
        pty = ptylib.spawn('docker', args, {
          name: 'xterm-color',
          cols: cols,
          rows: rows,
        });

        // Kill the container if it doesn't finish running within 90 seconds.
        // (There is already a 60-second timeout in run.sh, but this is here in
        // case the userspace timeout program is somehow circumvented within
        // the container.)
        const runTimeoutTimer = setTimeout(
            () => {
                console.log('Container ' + containerName + ' hasn\'t finished '
                    + 'running in time! Killing container');
                child_process.execFile('docker', ['kill', containerName]);
            },
            90000);

        // Send process output to websocket
        pty.on('data', data => {
            socket.emit('data', Buffer.from(data));
        });

        // Send input from websocket to process
        socket.on('data', data => {
            pty.write(data);
        });

        // Close the websocket when process exits
        pty.on('exit', (code, signal) => {
            console.log('Process exited (' + [code, signal] + ')');
            clearTimeout(runTimeoutTimer);
            pty = null;
            if (socket.connected) {
                socket.emit('exit', {code, signal});
            }
            shutdown();
        });
    });

    socket.on('resize', data => {
        cols = data.cols;
        rows = data.rows;
        if (pty) pty.resize(data.cols, data.rows);
    });

    socket.on('disconnect', function(){
        console.log('user disconnected');
        shutdown();
    });
});

http.listen(port, function(){
    console.log('listening on *:' + port);
});

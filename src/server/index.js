const path = require('path');
const child_process = require('child_process');
const ptylib = require('node-pty');
const uuidv4 = require('uuid/v4');
const fs = require('fs');
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 3000;

app.get('/', function(req, res){
    res.sendFile(path.resolve(__dirname + '/../client/index.html'));
});
app.get('/styles.css', function(req, res){
    res.sendFile(path.resolve(__dirname + '/../client/styles.css'));
});
app.get('/app.js', function(req, res){
    res.sendFile(path.resolve(__dirname + '/../../dist/client/bundle.js'));
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

        // Create data directory and save code from request
        const containerCodePath = '/code.c';
        if (!fs.existsSync(dataPath)) fs.mkdirSync(dataPath);
        fs.writeFileSync(codePath, cmdInfo.code);

        // Spawn pty/subprocess
        // TODO: clean up container/files even if the server crashes
        // TODO: allow selection of C++ compiler
        // TODO: separate user in container (don't use root)
        // TODO: performance quotas
        // TODO: deal with cppfiddle Docker image as part of build process
        const args = ['run', '-it', '--name', containerName,
            '-v', `${codePath}:${containerCodePath}:ro`,
            'cppfiddle', '/run.sh']
        pty = ptylib.spawn('docker', args, {
          name: 'xterm-color',
          cols: cols,
          rows: rows,
        });

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

const path = require('path');
const child_process = require('child_process');
const ptylib = require('node-pty');
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 3000;

app.get('/', function(req, res){
    res.sendFile(path.resolve(__dirname + '/../client/index.html'));
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

    socket.on('run', cmdInfo => {
        if (pty) {
            console.log('Warning: Got run command even though we '
                + 'already have a pty');
            return;
        }

        // Spawn pty/subprocess
        console.log('Running command ' + cmdInfo.cmd);
        const cmd = cmdInfo.cmd[0];
        const args = cmdInfo.cmd.slice(1);
        pty = ptylib.spawn(cmd, args, {
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
            console.log('Process exited');
            console.log([code, signal]);
            pty = null;
            if (socket.connected) {
                socket.emit('exit', {code, signal});
            }
            socket.disconnect();
        });
    });

    socket.on('resize', data => {
        cols = data.cols;
        rows = data.rows;
        if (pty) pty.resize(data.cols, data.rows);
    });

    socket.on('disconnect', function(){
        console.log('user disconnected');
        if (pty) {
            pty.kill();
            // Send SIGKILL if no exit in 1 second
            setTimeout(() => { if (pty) pty.destroy() }, 1000);
            // TODO: need to use "docker kill" for safety
        }
    });
});

http.listen(port, function(){
    console.log('listening on *:' + port);
});

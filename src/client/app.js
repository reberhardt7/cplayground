import { Terminal } from 'xterm';
import * as fit from 'xterm/lib/addons/fit/fit';
import * as webLinks from 'xterm/lib/addons/webLinks/webLinks';
import { ResizeSensor } from 'css-element-queries';

Terminal.applyAddon(fit);
Terminal.applyAddon(webLinks);

const terminalContainer = document.getElementById('terminal-container');
const term = new Terminal({});
term.open(terminalContainer);
// TODO: do this whenever the container size changes
term.fit();
window.term = term;     // TODO remove

// TODO: send command over established websocket
let socket = io.connect('', {query: {
    rows: term.rows,
    cols: term.cols,
}});

console.log(ResizeSensor);
new ResizeSensor(terminalContainer, function(){ 
    term.fit();
    socket.emit('resize', {rows: term.rows, cols: term.cols});
});

let decoder = new TextDecoder();
socket.on('data', data => {
    term.write(decoder.decode(data));
});
term.on('data', data => {
    socket.emit('data', data);
});

socket.on('exit', exitInfo => {
    const colorCode = (exitInfo.signal === 0 && exitInfo.code === 0
        ? '\x1b[32m'    // green
        : '\x1b[33m');  // yellow
    const resetCode = '\x1b[0m';
    if (exitInfo.signal) {
        term.write(colorCode + 'Execution finished (program received signal '
            + exitInfo.signal + ')' + resetCode);
    } else {
        term.write(colorCode + 'Execution finished (status code '
            + exitInfo.code + ')' + resetCode);
    }
});

socket.emit('run', {
    cmd: ['zsh'],
});

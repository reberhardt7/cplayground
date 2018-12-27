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

function printBanner(text, fg, bg, padToWidth) {
    const lpad = ' '.repeat(Math.floor((padToWidth - text.length) / 2));
    const rpad = ' '.repeat(Math.ceil((padToWidth - text.length) / 2));
    term.write(fg + bg + lpad + text + rpad + '\x1b[0m');
}

socket.on('exit', exitInfo => {
    const colorCode = (exitInfo.signal === 0 && exitInfo.code === 0
        ? '\x1b[92m'    // green
        : '\x1b[93m');  // yellow
    const bgColor = '\x1b[100m';   // light gray
    const bannerWidth = 52;     // should match run.sh
    // TODO: make bannerWidth the width of the console
    if (exitInfo.signal) {
        printBanner('Execution finished (program received signal '
            + exitInfo.signal + ')', colorCode, bgColor, bannerWidth);
    } else {
        printBanner('Execution finished (status code ' + exitInfo.code + ')',
            colorCode, bgColor, bannerWidth);
    }
});

socket.emit('run', {
    code: 'int main() { printf("hello world\\n"); return 0; }',
});

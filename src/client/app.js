import { Terminal } from 'xterm';
import * as fit from 'xterm/lib/addons/fit/fit';
import * as webLinks from 'xterm/lib/addons/webLinks/webLinks';
import { ResizeSensor } from 'css-element-queries';
import * as WebfontLoader from 'xterm-webfont'

Terminal.applyAddon(fit);
Terminal.applyAddon(webLinks);
Terminal.applyAddon(WebfontLoader)

const terminalContainer = document.getElementById('terminal');
const term = new Terminal({
    fontFamily: 'Ubuntu Mono',
    fontSize: 16,
    theme: {
        foreground: '#d6dbd8',
        background: '#352e3c',
        black: "#29282e",
        red: "#a63939",
        green: "#87a140",
        yellow: "#dba858",
        blue: "#5b81a0",
        magenta: "#85678f",
        cyan: "#5e8d87",
        white: "#707880",
        brightBlack: "#4f495f",
        brightRed: "#d85b7b",
        brightGreen: "#92c74d",
        brightYellow: "#f0d974",
        brightBlue: "#81a2be",
        brightMagenta: "#b294bb",
        brightCyan: "#8abeb7",
        brightWhite: "#c5c8c6"
    }
});
term.loadWebfontAndOpen(terminalContainer).then(() => term.fit());
window.term = term;     // TODO remove
let socket;
window.socket = socket; // TODO remove
new ResizeSensor(terminalContainer, function(){
    term.fit();
    if (socket) socket.emit('resize', {rows: term.rows, cols: term.cols});
});
term.on('data', data => {
    if (socket) socket.emit('data', data);
});

// TODO: Add loading spinner, and disallow execute() while it's aready in
// progress
function execute() {
    term.reset();
    // TODO: send command over established websocket
    socket = io.connect('', {query: {
        rows: term.rows,
        cols: term.cols,
    }});

    console.log(ResizeSensor);

    let decoder = new TextDecoder();
    socket.on('data', data => {
        term.write(decoder.decode(data));
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
        code: document.getElementById('editor').value,
    });
}

document.getElementById('run-btn').onclick = execute;
document.onkeydown = function(e) {
    const event = e || window.event;
    // Execute on shift+enter
    if (e.keyCode === 13 && e.shiftKey) {
        execute();
        return false;
    }
}

document.getElementById('editor').onkeydown = function(e) {
    e = e || window.event;
    if(e.keyCode==9 || e.which==9){
        e.preventDefault();
        var s = this.selectionStart;
        this.value = this.value.substring(0,this.selectionStart) + "\t" + this.value.substring(this.selectionEnd);
        this.selectionEnd = s + 1;
    }
}

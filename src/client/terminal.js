import { Terminal } from 'xterm';
import * as fit from 'xterm/lib/addons/fit/fit';
import * as webLinks from 'xterm/lib/addons/webLinks/webLinks';
import { ResizeSensor } from 'css-element-queries';
import * as WebfontLoader from 'xterm-webfont'

Terminal.applyAddon(fit);
Terminal.applyAddon(webLinks);
Terminal.applyAddon(WebfontLoader)

export function makeTerminal(terminalElem, appState) {
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
            white: "#818890",
            brightBlack: "#4f495f",
            brightRed: "#d85b7b",
            brightGreen: "#92c74d",
            brightYellow: "#f0d974",
            brightBlue: "#7daad1",
            brightMagenta: "#b294bb",
            brightCyan: "#87c6be",
            brightWhite: "#c5c8c6"
        }
    });
    appState.term = term;

    // Load font before creating the terminal in the DOM
    // https://github.com/xtermjs/xterm.js/issues/1164
    term.loadWebfontAndOpen(terminalElem).then(() => term.fit());

    // On resize, inform the server
    new ResizeSensor(terminalElem, function(){
        term.fit();
        if (appState.socket) {
            appState.socket.emit('resize', {rows: term.rows, cols: term.cols});
        }
    });

    // Send stdin over the websocket (if one is open)
    term.on('data', data => {
        if (appState.socket) appState.socket.emit('data', data);
    });
}

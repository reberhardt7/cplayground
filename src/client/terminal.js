import { Terminal } from 'xterm';
import * as fit from 'xterm/lib/addons/fit/fit';
import * as webLinks from 'xterm/lib/addons/webLinks/webLinks';
import { ResizeSensor } from 'css-element-queries';
import * as WebfontLoader from 'xterm-webfont'

Terminal.applyAddon(fit);
Terminal.applyAddon(webLinks);
Terminal.applyAddon(WebfontLoader)

function getTerminalColors() {
    // HACK: xterm needs the terminal colors JS-side, but we've declared them
    // in the stylesheets, and I don't want to declare them in multiple places
    // (especially since we have multiple themes). So this code iterates over
    // the CSS rules and extracts the colors we're looking for.
    //
    // NOTE: only call this function *after* you're sure the stylesheets have
    // loaded (e.g. after the body load event)
    const colors = {};
    for (let stylesheet of Array.from(document.styleSheets)) {
        let rules;
        try {
            rules = stylesheet.rules || stylesheet.cssRules;
        } catch {
            // Some browsers throw an exception if we're trying to inspect a
            // stylesheet from a different domain
            continue;
        }
        if (!rules) continue;
        for (let rule of Array.from(rules)) {
            if (!rule.selectorText) continue;
            const match = rule.selectorText.match(/^.term-color-([a-zA-Z]+)$/);
            if (match) {
                colors[match[1]] = rule.style['color'];
            }
        }
    }
    console.log(colors);
    return colors;
}

export function makeTerminal(terminalElem, appState) {
    const term = new Terminal({
        fontFamily: 'Ubuntu Mono',
        fontSize: 16,
        theme: getTerminalColors(),
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

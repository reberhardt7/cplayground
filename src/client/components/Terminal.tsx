import * as React from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
// @ts-ignore: There are no TS defs for this library, but I don't have time to write some
import * as XtermWebfont from 'xterm-webfont/src';
import { ResizeSensor } from 'css-element-queries';
import { bindSocketToTerminal, BoundSocketListeners, releaseSocketFromTerminal } from '../server-comm';
// eslint-disable-next-line no-undef
import Socket = SocketIOClient.Socket;

type TerminalProps = {
    id?: string;
    socket?: Socket;
    onResize?: (rows: number, cols: number) => void;
}

function getTerminalColors(): {[key: string]: string} {
    // HACK: xterm needs the terminal colors JS-side, but we've declared them
    // in the stylesheets, and I don't want to declare them in multiple places
    // (especially since we have multiple themes). So this code iterates over
    // the CSS rules and extracts the colors we're looking for.
    //
    // NOTE: only call this function *after* you're sure the stylesheets have
    // loaded (e.g. after the body load event)
    const colors: {[key: string]: string} = {};
    Array.from(document.styleSheets).forEach((stylesheet: CSSStyleSheet) => {
        let rules;
        try {
            rules = stylesheet.rules || stylesheet.cssRules;
        } catch {
            // Some browsers throw an exception if we're trying to inspect a
            // stylesheet from a different domain
            return;
        }
        if (!rules) return;
        Array.from(rules).forEach((rule: CSSStyleRule) => {
            if (!rule.selectorText) return;
            const match = rule.selectorText.match(/^.term-color-([a-zA-Z]+)$/);
            if (match) {
                colors[match[1]] = rule.style.color;
            }
        });
    });
    return colors;
}

class Terminal extends React.Component<TerminalProps> {
    xtermDiv: React.RefObject<HTMLDivElement>;

    term: XTerm;

    fitAddon: FitAddon;

    // Detect changes in the size of xtermDiv and trigger rerenders / report updated size to server
    resizeSensor: ResizeSensor;

    // If set, call this function when the user types something into the terminal
    sendDataToSocket?: (data: string) => void;

    // If set, call this function when there is a resize
    sendResizeToSocket?: (rows: number, cols: number) => void;

    // Opaque object containing functions that were bound to the socket as event listeners.
    // We just need to remember these so that we can unbind the functions if this component
    // unmounts.
    boundSocketListeners?: BoundSocketListeners;

    constructor(props: TerminalProps) {
        super(props);
        this.xtermDiv = React.createRef();
    }

    componentDidMount(): void {
        this.term = new XTerm({
            fontFamily: 'Ubuntu Mono',
            fontSize: 16,
            theme: getTerminalColors(),
        });
        this.fitAddon = new FitAddon();
        this.term.loadAddon(this.fitAddon);
        this.term.loadAddon(new WebLinksAddon());
        this.term.loadAddon(new XtermWebfont());

        // Load font before creating the terminal in the DOM
        // https://github.com/xtermjs/xterm.js/issues/1164
        // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
        // @ts-ignore (No TS definitions for xterm-webfont)
        this.term.loadWebfontAndOpen(this.xtermDiv.current)
            .then(() => this.fitAddon.fit());

        this.resizeSensor = new ResizeSensor(this.xtermDiv.current, this.onResize);

        if (this.props.socket) {
            this.bindToSocket(this.props.socket);
        }

        // Send stdin over the websocket (if one is open). Ideally this would be set up in
        // bindToSocket, but I don't know that xtermjs has a way to de-register listeners, and I
        // don't want to set up multiple listeners if bindToSocket gets called multiple times
        this.term.onData((data: string) => {
            if (this.sendDataToSocket) {
                this.sendDataToSocket(data);
            }
        });
    }

    componentDidUpdate(prevProps: Readonly<TerminalProps>): void {
        if (this.props.socket === prevProps.socket) {
            return;
        }

        // Handle changes in socket
        if (prevProps.socket) {
            this.detachFromSocket(prevProps.socket);
        }
        if (this.props.socket) {
            // Clear terminal for new connection
            this.term.reset();
            this.bindToSocket(this.props.socket);
        }
    }

    componentWillUnmount(): void {
        this.term.dispose();
        this.resizeSensor.detach(this.onResize);
        if (this.props.socket) {
            this.detachFromSocket(this.props.socket);
        }
    }

    onResize = (): void => {
        this.fitAddon.fit();
        // Notify server of resize if socket is bound
        if (this.sendResizeToSocket) {
            this.sendResizeToSocket(this.term.rows, this.term.cols);
        }
        // Notify parent component
        if (this.props.onResize) {
            this.props.onResize(this.term.rows, this.term.cols);
        }
    };

    bindToSocket(socket: Socket): void {
        // Bind onReceiveSocketData to be run whenever data comes in, and save two functions
        // (provided by server-comm.ts) to be called when we want to send data or announce a
        // resize
        this.boundSocketListeners = bindSocketToTerminal(
            socket,
            (data: string) => this.term.write(data),
            (fn: (data: string) => void) => {
                this.sendDataToSocket = fn;
            },
            (fn: (r: number, c: number) => void) => {
                this.sendResizeToSocket = fn;
            },
        );
    }

    detachFromSocket(socket: Socket): void {
        releaseSocketFromTerminal(socket, this.boundSocketListeners);
        this.boundSocketListeners = null;
        this.sendDataToSocket = null;
        this.sendResizeToSocket = null;
    }

    render(): React.ReactNode {
        return (
            <div className="terminal-container">
                <div id={this.props.id || 'terminal'} ref={this.xtermDiv} />
            </div>
        );
    }
}

export default Terminal;

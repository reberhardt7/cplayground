import axios, { AxiosResponse } from 'axios';
// eslint-disable-next-line no-undef
import Socket = SocketIOClient.Socket;

// Make sure this stays in sync with index.js in the backend
export const SUPPORTED_VERSIONS = ['C99', 'C11', 'C++11', 'C++14', 'C++17'];
export const OPTIMIZATION_LEVELS = ['-O0', '-O1', '-O2', '-O3'];
export const COMPILER_FLAGS = [
    { flag: '-Wall', label: '-Wall (recommended warnings)' },
    { flag: '-no-pie', label: '-no-pie (disable relocations)' },
    { flag: '-fpie -Wl,-pie', label: '-fpie -Wl,-pie (ASLR)' },
    {
        flag: '-fstack-protector-strong',
        label: '-fstack-protector-strong (anti-stack smashing)',
    },
];
export const LINKER_FLAGS = [
    { flag: '-lm', label: '-lm (math)' },
    { flag: '-pthread', label: '-pthread (threading)' },
    { flag: '-lcrypt', label: '-lcrypt (crypto)' },
    { flag: '-lreadline', label: '-lreadline' },
    { flag: '-lrt', label: '-lrt' },
];

export type Program = {
    code: string;
    runtimeArgs: string;
    includeFileName: string;
    includeFileData: string;
    language: typeof SUPPORTED_VERSIONS[number];
    flags: Set<string>;
}

export function getProgram(programId?: string): Promise<Program> {
    return axios.get(`/api/getProgram${(programId ? `?p=${programId}` : '')}`)
        .then((resp: AxiosResponse): Program => ({
            code: resp.data.code,
            runtimeArgs: resp.data.runtimeArgs,
            includeFileName: resp.data.includeFileName,
            includeFileData: resp.data.includeFileData,
            language: resp.data.language,
            flags: new Set(resp.data.flags),
        }));
}

/**
 * Opens a websocket to the server and sends the server the current terminal dimensions. The program
 * is not executed quite yet, but a Socket is returned that can be used to start execution later.
 * @param rows: Width of terminal
 * @param cols: Height of terminal
 */
export function makeDockerSocket(rows: number, cols: number): Socket {
    // Open connection to the backend
    // eslint-disable-next-line no-undef
    const socket = io.connect('', { query: { rows, cols } });

    socket.on('saved', (alias: string) => {
        // We use replaceState here (instead of pushState) because we don't
        // want to blow up a user's history if they spend a while in the editor
        // making several runs. (It would be pretty hard to use the back button
        // to get back to whatever site directed them here, if they've run 100
        // iterations of some program.)
        window.history.replaceState(null, null, `?p=${alias}`);
        // Inform the parent of this iframe (if this is an embed) that we've
        // loaded new saved code
        window.parent.postMessage({
            eventType: 'cplayground-updated',
            location: window.location.href,
        }, '*');
    });

    return socket;
}

/**
 * Sends a program to the server for execution. Returns a promise that is resolved when the program
 * finishes executing.
 * @param socket: Connected socket used to communicate with server
 * @param program: Program to execute
 */
export function startProgram(socket: Socket, program: Program): Promise<void> {
    socket.emit('run', {
        code: program.code,
        language: program.language,
        flags: [...program.flags],
        args: program.runtimeArgs,
        includeFile: {
            name: program.includeFileName,
            data: program.includeFileData,
        },
    });
    return new Promise((resolve: () => void): void => {
        socket.on('disconnect', resolve);
    });
}

export type BoundSocketListeners = {
    data: (data: ArrayBuffer) => void;
};

/**
 * Adds event listeners to the provided socket that are called when incoming data arrives via the
 * socket, and calls `onSend` and `onResize`, passing them functions that should be called when
 * the terminal has data to send (i.e. user input) or resizes.
 * @param socket: socket to add event listeners to
 * @param onReceive: callback function that will be invoked when data is received from socket
 * @param onSend: called immediately, supplying a function that should be called when there is
 *     data to send (i.e. terminal has user input)
 * @param onResize: called immediately, supplying a function that should be called when the terminal
 *     is resized
 * @returns a BoundSocketListeners object that can be passed to releaseSocketFromTerminal to degister
 *     the socket event listeners that get added by this function
 */
export function bindSocketToTerminal(
    socket: Socket,
    onReceive: (data: string) => void,
    onSend: (fn: (data: string) => void) => void,
    onResize: (fn: (r: number, c: number) => void) => void,
): BoundSocketListeners {
    const decoder = new TextDecoder();
    const socketOnData = (data: ArrayBuffer): void => {
        onReceive(decoder.decode(data));
    };
    socket.on('data', socketOnData);
    onSend((data: string) => {
        socket.emit('data', data);
    });
    onResize((rows: number, cols: number) => {
        socket.emit('resize', { rows, cols });
    });
    return {
        data: socketOnData,
    };
}

/**
 * De-registers the socket event listeners that were registered by bindSocketToTerminal
 * @param socket
 * @param boundListeners
 */
export function releaseSocketFromTerminal(
    socket: Socket,
    boundListeners: BoundSocketListeners,
): void {
    Object.keys(boundListeners).forEach(
        (event: keyof BoundSocketListeners) => socket.removeListener(event, boundListeners[event]),
    );
}

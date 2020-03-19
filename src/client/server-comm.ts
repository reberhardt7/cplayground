import axios, { AxiosResponse } from 'axios';
import { RunEventBody, SavedProgram } from '../common/communication';
// eslint-disable-next-line no-undef
import Socket = SocketIOClient.Socket;

export function getProgram(programId?: string): Promise<SavedProgram> {
    return axios.get(`/api/getProgram${(programId ? `?p=${programId}` : '')}`)
        .then((resp: AxiosResponse): SavedProgram => ({
            code: resp.data.code,
            runtimeArgs: resp.data.runtimeArgs,
            includeFileId: resp.data.includeFileId,
            includeFileName: resp.data.includeFileName,
            language: resp.data.language,
            flags: resp.data.flags,
        }));
}

/**
 * Opens a websocket to the server. No program is executed yet, but a Socket is returned that can
 * be used to start execution later.
 */
export function makeDockerSocket(): Socket {
    // Open connection to the backend
    // eslint-disable-next-line no-undef
    const socket = io.connect('');

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
 * @param rows: Width of terminal
 * @param cols: Height of terminal
 */
export function startProgram(
    socket: Socket, program: SavedProgram, rows: number, cols: number,
): Promise<void> {
    const body: RunEventBody = {
        code: program.code,
        language: program.language,
        flags: [...program.flags],
        args: program.runtimeArgs,
        includeFileId: program.includeFileId,
        rows,
        cols,
        debug: true,
    };
    socket.emit('run', body);
    return new Promise((resolve: () => void): void => {
        socket.on('disconnect', resolve);
    });
}

export function uploadFile(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    return axios.post('/api/files', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    }).then((resp: AxiosResponse): string => resp.data.id);
}

export type BoundSocketListeners = {
    data?: (data: ArrayBuffer) => void;
    debug?: (data: ArrayBuffer) => void;
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
 * @returns a BoundSocketListeners object that can be passed to releaseSocketFromTerminal to
 *     de-register the socket event listeners that get added by this function
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

export function bindSocketToDebugger(
    socket: Socket,
    onData: (data: {}) => void,
): BoundSocketListeners {
    socket.on('debug', onData);
    return {
        debug: onData,
    };
}

export function releaseSocketFromDebugger(
    socket: Socket,
    boundListeners: BoundSocketListeners,
): void {
    Object.keys(boundListeners).forEach(
        (event: keyof BoundSocketListeners) => socket.removeListener(event, boundListeners[event]),
    );
}

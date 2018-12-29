export function makeDockerSocket(appState) {
    // Open connection to the backend
    const socket = io.connect('', {query: {
        rows: appState.term.rows,
        cols: appState.term.cols,
    }});
    appState.socket = socket;

    // Display stdout/stderr in the terminal
    let decoder = new TextDecoder();
    socket.on('data', data => {
        appState.term.write(decoder.decode(data));
    });
}

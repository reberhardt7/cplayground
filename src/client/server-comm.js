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

    socket.on('saved', alias => {
        // We use replaceState here (instead of pushState) because we don't
        // want to blow up a user's history if they spend a while in the editor
        // making several runs. (It would be pretty hard to use the back button
        // to get back to whatever site directed them here, if they've run 100
        // iterations of some program.)
        history.replaceState(null, null, '?p=' + alias);
        // Inform the parent of this iframe (if this is an embed) that we've
        // loaded new saved code
        window.parent.postMessage({
            eventType: 'cplayground-updated',
            location: window.location.href,
        }, '*');
    });
}

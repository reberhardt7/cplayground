import {printBanner} from './terminal'

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

    // Display banner notice on program exit
    socket.on('exit', exitInfo => {
        const colorCode = (exitInfo.signal === 0 && exitInfo.code === 0
            ? '\x1b[92m'    // green
            : '\x1b[93m');  // yellow
        const bgColor = '\x1b[100m';   // light gray
        const bannerWidth = 52;     // should match run.sh
        // TODO: make bannerWidth the width of the console
        if (exitInfo.signal) {
            printBanner(appState.term,
                'Execution finished (program received signal '
                + exitInfo.signal + ')', colorCode, bgColor, bannerWidth);
        } else {
            printBanner(appState.term,
                'Execution finished (status code ' + exitInfo.code + ')',
                colorCode, bgColor, bannerWidth);
        }
    });
}

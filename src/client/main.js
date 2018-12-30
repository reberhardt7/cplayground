import {makeTerminal} from './terminal';
import {makeDockerSocket} from './server-comm';

let appState = {};

makeTerminal(document.getElementById('terminal'), appState);

const editor = ace.edit("editor");
editor.session.setMode("ace/mode/c_cpp");
editor.focus();
editor.setValue(`// Hello world!

// This is a handy environment for quickly testing out C/C++ code. It
// supports multiprocessing, multithreading, and any other low-level
// fanciness you might like to try. It also supports streaming stdin
// from your browser, so you can even run something like a shell from
// here!

#include <stdio.h>
#include <unistd.h>
#include <stdlib.h>
#include <sys/wait.h>

int main() {
    printf("Hello world! I am process %d\\n", getpid());
    pid_t pid = fork();
    printf("Hello again! I am process %d\\n", getpid());
    if (pid == 0) {
        return 0;
    }
    waitpid(pid, 0, 0);
    system("/usr/games/nsnake");
}`);
// Disable ACE custom cmd+l (goto line)
delete editor.keyBinding.$defaultHandler.commandKeyBinding["cmd-l"];
delete editor.keyBinding.$defaultHandler.commandKeyBinding["ctrl-l"];

function compileAndExec(code) {
    appState.term.reset();
    makeDockerSocket(appState);
    appState.socket.on('disconnect', function() {
        document.getElementById('run-btn').classList.remove('disabled');
        appState.socket = null;
    });
    document.getElementById('run-btn').classList.add('disabled');
    appState.socket.emit('run', {
        code: code,
    });
}

function handleRunBtnClick() {
    if (!appState.socket) {
        compileAndExec(editor.getValue());
    }
}

document.getElementById('run-btn').onclick = handleRunBtnClick;

document.onkeydown = function(e) {
    const event = e || window.event;
    // Execute code on shift+enter
    if (e.keyCode === 13 && e.shiftKey) {
        handleRunBtnClick();
        return false;
    }
}

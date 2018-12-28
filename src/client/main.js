import {makeTerminal} from './terminal';
import {makeDockerSocket} from './server-comm';

let appState = {};

makeTerminal(document.getElementById('terminal'), appState);

function compileAndExec(code) {
    appState.term.reset();
    makeDockerSocket(appState);
    appState.socket.emit('run', {
        code: code,
    });
}

function handleRunBtnClick() {
    compileAndExec(document.getElementById('editor').value);
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

document.getElementById('editor').onkeydown = function(e) {
    e = e || window.event;
    if(e.keyCode==9 || e.which==9){
        e.preventDefault();
        var s = this.selectionStart;
        this.value = this.value.substring(0,this.selectionStart) + "\t" + this.value.substring(this.selectionEnd);
        this.selectionEnd = s + 1;
    }
}

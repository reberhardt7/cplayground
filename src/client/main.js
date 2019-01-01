import {makeTerminal} from './terminal';
import {makeDockerSocket} from './server-comm';

let appState = {};

makeTerminal(document.getElementById('terminal'), appState);

const editor = ace.edit("editor");
editor.session.setMode("ace/mode/c_cpp");
editor.focus();
// In the CSS, we set the font color equal to the background color so that the
// initial code doesn't show as unformatted while we load JS. Now that we've
// loaded, set it to the proper color
document.getElementById('editor').style.color = 'inherit';
// Disable ACE custom cmd+l (goto line)
delete editor.keyBinding.$defaultHandler.commandKeyBinding["cmd-l"];
delete editor.keyBinding.$defaultHandler.commandKeyBinding["ctrl-l"];
// Show settings pane on cmd+comma
editor.commands.addCommand({
    bindKey: {win: "Ctrl-,", mac: "Command-,"},
    exec: toggleSettingsSidebar,
});

function getCompilerFlags() {
    const flags = [];
    for (let el of document.querySelectorAll('#compiler-flags select,'
                                           + '#compiler-flags input')) {
        if (el.tagName.toLowerCase() === 'select' || el.checked) {
            flags.push(el.value);
        }
    }
    return flags;
}

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
        language: document.getElementById('language-select').value,
        flags: getCompilerFlags(),
        args: document.getElementById('runtime-args').value,
    });
}

function handleRunBtnClick() {
    if (!appState.socket) {
        compileAndExec(editor.getValue());
    }
}

function toggleSettingsSidebar() {
    const primaryContainer =
        document.getElementsByClassName('primary-container')[0];
    if (primaryContainer.classList.contains('open-sidebar')) {
        primaryContainer.classList.remove('open-sidebar');
    } else {
        primaryContainer.classList.add('open-sidebar');
    }
    // Manually resize ACE editor after CSS transition has completed
    setTimeout(() => editor.resize(), 300);
}

document.getElementById('run-btn').onclick = handleRunBtnClick;

document.getElementById('settings-btn').onclick = toggleSettingsSidebar;

document.onkeydown = function(e) {
    const event = e || window.event;
    // Execute code on shift+enter
    if (e.keyCode === 13 && e.shiftKey) {
        handleRunBtnClick();
        return false;
    }
    // Open settings on cmd/ctrl+comma
    const isMac = ['Macintosh', 'MacIntel'].indexOf(window.navigator.platform) > -1;
    if ((isMac && e.metaKey && e.keyCode === 188)
            || (!isMac && e.ctrlKey && e.keyCode === 188)) {
        toggleSettingsSidebar();
        return false;
    }
}

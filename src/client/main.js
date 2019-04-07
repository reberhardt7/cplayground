import {makeTerminal} from './terminal';
import {makeDockerSocket} from './server-comm';

let appState = {};
const bodyTag = document.getElementsByTagName('body')[0];

window.addEventListener('load', () => {
    makeTerminal(document.getElementById('terminal'), appState);

    const editor = ace.edit("editor");
    editor.session.setMode("ace/mode/c_cpp");
    editor.focus();
    // In the CSS, we set the font color equal to the background color so that
    // the initial code doesn't show as unformatted while we load JS. Now that
    // we've loaded, set it to the proper color
    document.getElementById('editor').style.color = 'inherit';
    if (bodyTag.classList.contains('embedded')) {
        // Add 8px of padding at the top and bottom of the editor. This makes
        // things look nicer in the embedded code-only view, where we reduce
        // the editor margin to 0
        editor.renderer.setScrollMargin(8, 8);
    }
    // Disable ACE custom cmd+l (goto line)
    delete editor.keyBinding.$defaultHandler.commandKeyBinding["cmd-l"];
    delete editor.keyBinding.$defaultHandler.commandKeyBinding["ctrl-l"];
    // Show settings pane on cmd+comma
    editor.commands.addCommand({
        bindKey: {win: "Ctrl-,", mac: "Command-,"},
        exec: toggleSettingsSidebar,
    });
});

// Handle uploaded include files
const includeFile = window.includeFileFromServer || {name: '', data: new ArrayBuffer(0)};
window.includeFile = includeFile;
document.getElementById('input-include-file').addEventListener('change', e => {
    const file = e.target.files[0];
    if (file.size > 1 * Math.pow(10, 6)) {
        alert('The file you uploaded is too big! Max filesize 1MB');
        return;
    }
    includeFile.name = file.name;
    document.getElementById('uploaded-filename').innerText = file.name;
    const fileReader = new FileReader();
    fileReader.onload = () => {
        includeFile.data = fileReader.result;
        e.target.value = '';
    };
    fileReader.readAsArrayBuffer(file);
});
document.getElementById('btn-remove-uploaded-file').addEventListener('click', e => {
    includeFile.name = '';
    includeFile.data = new ArrayBuffer(0);
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
        includeFile: includeFile,
    });
}

function handleRunBtnClick() {
    // If we are in embedded mode, go into terminal-only view
    if (bodyTag.classList.contains('embedded')) {
        bodyTag.classList.remove('show-code-only');
        bodyTag.classList.remove('show-split');
        bodyTag.classList.add('show-term-only');
    }
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

function showEditorPane() {
    bodyTag.classList.remove('show-split');
    bodyTag.classList.remove('show-term-only');
    bodyTag.classList.add('show-code-only');
    // Manually resize ACE editor after CSS transition has completed
    setTimeout(() => editor.resize(), 300);
}

function showSplitView() {
    bodyTag.classList.remove('show-term-only');
    bodyTag.classList.remove('show-code-only');
    bodyTag.classList.add('show-split');
    // Manually resize ACE editor after CSS transition has completed
    setTimeout(() => editor.resize(), 300);
}

const buttonHandlers = {
    'run-btn': handleRunBtnClick,
    'settings-btn': toggleSettingsSidebar,
    'edit-btn': showEditorPane,
    'split-pane-btn': showSplitView,
    'open-in-cplayground-btn': () => {
        window.open(window.location.href.replace('/embed', '/'), "_blank");
    },
};

document.getElementById('run-btn').onclick = handleRunBtnClick;
for (let btnId in buttonHandlers) {
    if (document.getElementById(btnId)) {
        document.getElementById(btnId).onclick = buttonHandlers[btnId];
    }
}

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
    // Open editor pane on cmd/ctrl+e
    if ((isMac && e.metaKey && e.keyCode === 69)
            || (!isMac && e.ctrlKey && e.keyCode === 69)) {
        showEditorPane();
        return false;
    }
}

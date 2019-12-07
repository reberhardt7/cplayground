const fs = require('fs');
const readline = require('readline');

const CPLAYGROUND_PROCFILE = "/proc/cplayground";
const ENABLE_DEBUGGING = fs.existsSync(CPLAYGROUND_PROCFILE);

const FILE_FLAGS = {
    // Open flags:
    O_RDONLY: 00,
    O_WRONLY: 01,
    O_RDWR: 02,
    O_APPEND: 02000,
    O_NONBLOCK: 04000,
    O_NDELAY: 04000,
    O_SYNC: 04010000,
    O_ASYNC: 020000,
    O_DSYNC: 010000,
    O_NOATIME: 01000000,
    O_CLOEXEC: 02000000,
    // File type:
    S_IFIFO: 0010000,   // named pipe (fifo)
    S_IFCHR: 0020000,   // character special
    S_IFDIR: 0040000,   // directory
    S_IFBLK: 0060000,   // block special
    S_IFREG: 0100000,   // regular
    S_IFLNK: 0120000,   // symbolic link
    S_IFSOCK: 0140000,  // socket
};

/**
 * Given an octal string, returns an array of flag names
 */
function readFlags(octalStr) {
    let octal = parseInt(octalStr, 8);
    const flags = [];
    for (const flag in FILE_FLAGS) {
        if ((octal & FILE_FLAGS[flag]) === FILE_FLAGS[flag]) {
            flags.push(flag);
        }
    }
    // Edge case: if O_WRONLY or O_RDWR are set, remove O_RDONLY. (The flags
    // are mutually exclusive, and O_RDONLY is defined as 0 so it is
    // technically included in all possible modes.)
    if (flags.includes('O_WRONLY') || flags.includes('O_RDWR')) {
        flags.splice(flags.indexOf('O_RDONLY'), 1);
    }
    // Make sure there are no flags we might be missing
    for (const flag in FILE_FLAGS) {
        if ((octal & FILE_FLAGS[flag]) === FILE_FLAGS[flag]) {
            octal &= ~FILE_FLAGS[flag];
        }
    }
    if (octal) {
        console.warn(`Tried to determine all the flags that are included in ${octalStr}, `
            + `but there are some unknown ones remaining. Remaining value: `
            + `0${octal.toString(8)}`, flags);
    }
    return flags;
}

/**
 * Reads a line (corresponding to process info) from the kernel module output
 */
function readProcessLine(line) {
    const [
        namespaceID,    // hash of pid_namespace pointer
        globalPID,      // actual PID of process
        containerPID,   // PID of process as it appears within the container
        containerPPID,
        containerPGID,
        command,
    ] = line.split('\t');
    return {
        namespaceID,
        globalPID: Number(globalPID),
        containerPID: Number(containerPID),
        containerPPID: Number(containerPPID),
        containerPGID: Number(containerPGID),
        command,
        files: {},
    };
}

/**
 * Reads a line (corresponding to a file descriptor's info) from the kernel
 * module's output
 */
function readFileLine(line) {
    const [
        fd,             // fd number
        closeOnExec,    // true/false
        openFileID,     // hash of `struct file` pointer
        pos,            // byte offset
        flags,          // octal string
        vnodeName,      // e.g. "/dev/pts/0" or "pipe:[90222668]"
    ] = line.split('\t');
    return {
        fd: Number(fd),
        closeOnExec: Boolean(Number(closeOnExec)),
        openFileID,
        pos: Number(pos),
        flags: readFlags(flags),
        vnodeName,
    };
}

/**
 * Reads /proc/cplayground and stores the information from that file in a more
 * readily analyzed data structure:
 *
 * {
 *     namespace ID (hash of pid_namespace pointer): {
 *         container PID of process in namespace: {
 *             ... info about process and open files
 *         }
 *         ... other containers
 *     }
 *     ... other namespaces
 * }
 */
async function loadRawProcessInfo() {
    const rl = readline.createInterface({
        input: fs.createReadStream(CPLAYGROUND_PROCFILE),
    });
    const namespaces = {};
    let readingProcessLine = true;
    let currProcess;
    for await (const line of rl) {
        if (readingProcessLine) {
            currProcess = readProcessLine(line);
            if (namespaces[currProcess.namespaceID] === undefined) {
                namespaces[currProcess.namespaceID] = {};
            }
            const {namespaceID, globalPID, containerPID} = currProcess;
            if (namespaces[namespaceID][containerPID]) {
                console.warn(`Warning: container PID ${containerPID} appears `
                    + `multiple times in namespace ${namespaceID}! This `
                    + `should never happen.`, namespaces, currProcess);
            }
            if (Object.values(namespaces[namespaceID])
                    .filter(p => p.globalPID == globalPID).length) {
                console.warn(`Warning: global PID ${globalPID} appears `
                    + `multiple times in namespace ${namespaceID}! This `
                    + `should never happen.`, namespaces, currProcess);
            }
            namespaces[namespaceID][containerPID] = currProcess;
            readingProcessLine = false;
        } else if (line === '') {
            readingProcessLine = true;
            continue;
        } else {
            const file = readFileLine(line);
            if (currProcess.files[file.fd]) {
                console.warn(`Warning: fd ${file.fd} appears multiple times! `
                    + `This should never happen.`, namespaces, currProcess);
            }
            currProcess.files[file.fd] = readFileLine(line);
        }
    }
    return namespaces;
}

function deepCompare(obj1, obj2) {
    // TODO: come up with less hacky way to do this
    return JSON.stringify(obj1) === JSON.stringify(obj2);
}

/**
 * Given the data structure generated from loading the raw kernel file,
 * reorganizes this information in a way that is readily consumable by the
 * client. (E.g. strip out global PIDs, so that no extra-container info is
 * leaked)
 */
function reconstructTables(namespaces) {
    // Implementation note: try to log errors instead of throwing exceptions
    // unless something extremely bad happens, so that an issue with one
    // container does not bring down debugging for other containers
    const containers = {};
    for (const namespaceID in namespaces) {
        if (namespaces[namespaceID]['1'] === undefined) {
            console.warn(`Warning: namespace ${namespaceID} seems to be `
                + `missing an init process! This should never happen. `
                + `Skipping this container...`);
            continue;
        }
        const container = {
            processes: [],
            openFiles: {},
            vnodes: {},
        };
        containers[namespaces[namespaceID]['1'].globalPID] = container;

        // Populate processes
        for (const proc of Object.values(namespaces[namespaceID])) {
            // Skip the runc container-creating function, as well as our run.sh
            // script
            if (proc.containerPID <= 1) {
                continue;
            }
            const fds = { ...proc.files };
            for (const fd of Object.values(fds)) {
                fds[fd.fd] = { file: fd.openFileID, closeOnExec: fd.closeOnExec };
            }
            container.processes.push({
                pid: proc.containerPID,
                ppid: proc.containerPPID,
                pgid: proc.containerPGID,
                command: proc.command,
                fds,
            });
        }

        const files = Object.values(namespaces[namespaceID])
            .filter(process => process.containerPID > 1)
            .map(process => Object.values(process.files))
            .flat();

        // Populate open file table
        for (const file of files) {
            const openFileEntry = {
                position: file.pos,
                flags: file.flags,
                refcount: 1,
                vnode: file.vnodeName,
            };
            if (container.openFiles[file.openFileID] === undefined) {
                container.openFiles[file.openFileID] = openFileEntry;
            } else if (deepCompare({...openFileEntry, refcount: undefined},
                    {...container.openFiles[file.openFileID], refcount: undefined})) {
                container.openFiles[file.openFileID].refcount++;
            } else {
                console.error(`In namespace ${namespaceID}, there is already `
                    + `an open file ${file.openFileID} with different info `
                    + `compared to this open file entry!`, openFileEntry,
                    container.openFiles[file.openFileID], namespaces);
            }
        }

        // Populate vnode table
        for (const file of files) {
            const vnodeEntry = {
                name: file.vnodeName,
                refcount: 0,
            };
            if (container.vnodes[file.vnodeName] === undefined) {
                container.vnodes[file.vnodeName] = vnodeEntry;
            } else if (!deepCompare(vnodeEntry, container.vnodes[file.vnodeName])) {
                console.error(`In namespace ${namespaceID}, there is already `
                    + `a vnode ${file.vnodeName} with different info `
                    + `compared to this open file entry!`, vnodeEntry,
                    container.vnodes[file.vnodeName], namespaces);
            }
        }
        for (const openFile of Object.values(container.openFiles)) {
            container.vnodes[openFile.vnode].refcount++;
        }
    }
    return containers;
}

let processInfo;

/**
 * Start the polling mechanism that loads info from /proc/cplayground
 */
async function init() {
    processInfo = reconstructTables(await loadRawProcessInfo());
    // TODO: only poll the file if there is an active debugging session
    setInterval(async () => {
        processInfo = reconstructTables(await loadRawProcessInfo());
    }, 1000);
}

async function getContainerInfo(containerId) {
    const pidFile = `/sys/fs/cgroup/pids/docker/${containerId}/cgroup.procs`;
    let initPid;

    const stream = fs.createReadStream(pidFile);
    stream.on('error', (err) => {
        if (err.code == 'ENOENT') {
            console.log(`Note: file ${pidFile} has disappeared. This is probably `
                + `okay; the container probably just exited.`);
        } else {
            console.error(`Unexpected error reading ${pidFile}:`, err);
        }
    });
    const rl = readline.createInterface({
        input: stream,
    });
    for await (const line of rl) {
        initPid = line;
        rl.close();
        break;
    }
    return processInfo[initPid];
}

module.exports = { ENABLE_DEBUGGING, init, getContainerInfo };

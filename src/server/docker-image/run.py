#! /usr/bin/env python3

import os
import subprocess
import shlex
import time
import sys
import socket

# TODO: in the future, make BANNER_WIDTH dependent on the size of the terminal.
# (This might be tricky; there seems to be a race condition with docker or
# node-pty or something where the terminal size isn't being correctly set until
# after this script already starts running.)
BANNER_WIDTH = 60
RED = '\033[91m'
GREEN = '\033[92m'
YELLOW = '\033[93m'
CYAN = '\033[96m'
LIGHT_GRAY = '\033[100m'
CLEAR = '\033[0m'

def print_banner(msg, fg_color, bg_color):
    lpad_len = (BANNER_WIDTH - len(msg)) // 2
    rpad_len = (BANNER_WIDTH - len(msg) + 1) // 2
    print(f"{fg_color}{bg_color}{' ' * lpad_len}{msg}{' ' * rpad_len}{CLEAR}")

def format_execution_time(elapsed_s):
    if (elapsed_s >= 1):
        return f'{elapsed_s:.3f} seconds'
    else:
        return f'{(elapsed_s * 1000):.3f} ms'

def status_matches_signal(status, signal):
    """
    Check whether a returned status code indicates that the process was terminated with the given
    signal. (If the process was launched using Python's subprocess library and was killed by
    signal n, the given code will be -n. However, this isn't technically a valid return code,
    since status codes are unsigned ints, so shells typically report signals as 128 + n. We do
    something similar if the process is being debugged under gdb.)
    """
    return status == -signal or status == signal + 128

def print_exit_status(status):
    # SIGXCPU
    if status_matches_signal(status, 24) or status_matches_signal(status, 30):
        print_banner('The program exceeded its CPU quota.', RED, LIGHT_GRAY)
    # SIGKILL (possibly from OOM killer?)
    elif status_matches_signal(status, 9):
        print_banner('The program was killed by SIGKILL. If you aren\'t sure', RED, LIGHT_GRAY)
        print_banner('why, it was probably using too much memory.', RED, LIGHT_GRAY)
    # Print exit status
    print_banner(f'Execution finished (exit status {status})',
        (GREEN if status == 0 else YELLOW), LIGHT_GRAY)

def compile():
    static_libraries_str = (subprocess.check_output(['find', '/cplayground/lib', '-name', '*.a'])
        .decode('utf-8')
        .strip())
    static_libraries = static_libraries_str.split('\n') if static_libraries_str else []
    compile_cmd = [os.environ['COMPILER'], '-o', '/cplayground/output', os.environ['SRCPATH'],
        '-I/cplayground/include', '-L/cplayground/lib', *static_libraries,
        *shlex.split(os.environ['CFLAGS'])]
    print(' '.join(compile_cmd))
    compile_start_time = time.time()
    compile_proc = subprocess.run(compile_cmd)
    return (compile_proc.returncode, time.time() - compile_start_time)

def run():
    user_start_time = time.time()
    if os.environ.get('CPLAYGROUND_DEBUG', False):
        with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as gdbsock:
            gdbsock.connect('/gdb.sock')
            sockfile = gdbsock.makefile('b', 0)
            args = ['gdb', '--tty=/dev/pts/0', '-i=mi', '--args', '/cplayground/output'] + sys.argv[1:]
            user_proc = subprocess.Popen(args, stdin=sockfile, stdout=sockfile, stderr=sockfile)
            user_proc.wait()
    else:
        user_proc = subprocess.run(['/cplayground/output'] + sys.argv[1:])
    return (user_proc.returncode, time.time() - user_start_time)

def main():
    os.mkdir('/cplayground/include')
    os.mkdir('/cplayground/lib')
    if os.path.isfile('/cplayground/include.zip'):
        subprocess.check_call(['unzip', '-q', '/cplayground/include.zip', '-d', '/cplayground/'])

    # Compile
    print_banner('Compiling...', CYAN, LIGHT_GRAY)
    compile_status, compile_time = compile()
    if compile_status != 0:
        print_exit_status(compile_status)
        return compile_status
    print_banner('Compiled in ' + format_execution_time(compile_time), GREEN, LIGHT_GRAY)

    # Run
    print_banner('Executing...', CYAN, LIGHT_GRAY)
    run_status, run_time = run()
    print_exit_status(run_status)
    print_banner('Executed in ' + format_execution_time(run_time),
        (GREEN if run_status == 0 else YELLOW), LIGHT_GRAY)

    # Wait for 0.1 seconds to give any lingering child processes a chance to print
    time.sleep(0.1)

    return run_status

if __name__ == '__main__':
    sys.exit(main())
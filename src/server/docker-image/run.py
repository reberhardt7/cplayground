#! /usr/bin/env python3

import os
import subprocess
import shlex
import time
import sys
import socket
import signal
import shutil

RED = '\033[91m'
GREEN = '\033[92m'
YELLOW = '\033[93m'
CYAN = '\033[96m'
LIGHT_GRAY = '\033[100m'
CLEAR = '\033[0m'

def print_banner(msg, fg_color, bg_color):
    terminal_size = shutil.get_terminal_size()
    banner_width = terminal_size[0]
    lpad_len = (banner_width - len(msg)) // 2
    rpad_len = (banner_width - len(msg) + 1) // 2
    print(f"{fg_color}{bg_color}{' ' * lpad_len}{msg}{' ' * rpad_len}{CLEAR}")

def format_execution_time(elapsed_s):
    if (elapsed_s >= 1):
        return f'{elapsed_s:.3f} seconds'
    else:
        return f'{(elapsed_s * 1000):.3f} ms'

def print_exit_status(status):
    # SIGXCPU
    if status in [128 + 24, 128 + 30]:
        print_banner('The program exceeded its CPU quota.', RED, LIGHT_GRAY)
    # SIGKILL (possibly from OOM killer?)
    elif status == 128 + 9:
        print_banner('The program was killed by SIGKILL. If you aren\'t sure', RED, LIGHT_GRAY)
        print_banner('why, it was probably using too much memory.', RED, LIGHT_GRAY)
    # SIGSEGV
    elif status == 128 + 11:
        print('Segmentation fault')
    # Print exit status
    print_banner(f'Execution finished (exit status {status})',
        (GREEN if status == 0 else YELLOW), LIGHT_GRAY)

def become_fg_process():
    """
    Executed in the child process to assume control over the terminal
    """
    os.setpgrp()
    ttou_handler = signal.signal(signal.SIGTTOU, signal.SIG_IGN)
    tty = os.open('/dev/tty', os.O_RDWR)
    os.tcsetpgrp(tty, os.getpgrp())
    os.close(tty)
    signal.signal(signal.SIGTTOU, ttou_handler)

def compile():
    static_libraries_str = (subprocess.check_output(['find', '/cplayground/lib', '-name', '*.a'])
        .decode('utf-8')
        .strip())
    static_libraries = static_libraries_str.split('\n') if static_libraries_str else []
    compile_cmd = [os.environ['COMPILER'], '-o', '/cplayground/cplayground', os.environ['SRCPATH'],
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
            args = ['gdb', '--tty=/dev/pts/0', '-i=mi', '--args', '/cplayground/cplayground'] + sys.argv[1:]
            user_proc = subprocess.Popen(args, stdin=sockfile, stdout=sockfile, stderr=sockfile,
                                         preexec_fn=become_fg_process)
            user_proc.wait()
    else:
        user_proc = subprocess.run(['/cplayground/cplayground'] + sys.argv[1:],
                                   preexec_fn=become_fg_process)
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
    if run_status < 0:
        # subprocess.Popen uses a negative status to indicate that a process was killed by a
        # signal. However, we will use the more-universal convention of 128 + signal
        run_status = 128 - run_status
    print_exit_status(run_status)
    print_banner('Executed in ' + format_execution_time(run_time),
        (GREEN if run_status == 0 else YELLOW), LIGHT_GRAY)

    # Wait for 0.1 seconds to give any lingering child processes a chance to print
    time.sleep(0.1)

    return run_status

if __name__ == '__main__':
    sys.exit(main())
// Hello world!

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
    printf("Hello world! I am process %d\n", getpid());
    pid_t pid = fork();
    printf("Hello again! I am process %d\n", getpid());
    if (pid == 0) {
        return 0;
    }
    waitpid(pid, 0, 0);
    system("/usr/games/nsnake");
}

#include <errno.h>
#include <stddef.h>
#include <stdlib.h>
#include <stdio.h>
#include <unistd.h>

#include <linux/filter.h>
#include <linux/seccomp.h>
#include <linux/audit.h>

#include <sys/types.h>
#include <sys/prctl.h>
#include <sys/syscall.h>
#include <sys/socket.h>

// based on https://eigenstate.org/notes/seccomp.html
// relevant reading: https://lwn.net/Articles/656307/
// note since the cplayground is open source and the user can easily
// submit arbitrary programs, arguments about probing defenses are
// not particularly meaningful
// we use RET_ERRNO with ERFKILL - relatively arbitrary, and distinct
// from most errors we would expect to see in cplayground
#define SECCOMP_DENY(syscall) \
    BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, __NR_##syscall, 0, 1), \
    BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ERRNO | (ERFKILL & SECCOMP_RET_DATA))

struct sock_filter filter[] = {
    // validate arch, kill on mismatch
    BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, arch)),
    BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, AUDIT_ARCH_X86_64, 1, 0),
    BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_KILL),

    // load syscall
    BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, nr)),

    // list of blocked syscalls
    SECCOMP_DENY(ptrace),

    // if we don't match above, permit
    // (docker and friends should stack on top of this)
    BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ALLOW),
};

struct sock_fprog filterprog = {
    .len = sizeof(filter)/sizeof(filter[0]),
    .filter = filter
};

int main(int argc, char *argv[]) {
    if (argc < 2) exit(99);

    if (prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0)) {
        exit(100);
    }
    if (prctl(PR_SET_SECCOMP, SECCOMP_MODE_FILTER, &filterprog) == -1) {
        exit(100);
    }

    // the argv array is guaranteed to be null-terminated
    // (https://stackoverflow.com/a/11020198)
    execvp(argv[1], &argv[1]);

    return 101;
}
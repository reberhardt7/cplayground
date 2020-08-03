#include <linux/init.h>
#include <linux/module.h>
#include <linux/kernel.h>
#include <linux/sched.h>            // for_each_process, pr_info
#include <linux/sched/signal.h>     // for_each_process, pr_info
#include <linux/nsproxy.h>          // struct nsproxy
#include <linux/pid_namespace.h>          // task_active_pid_ns
#include <linux/fdtable.h>
#include <linux/file.h>
#include <linux/crypto.h>
#include <crypto/hash.h>
#include <asm/atomic.h>
#include <linux/dcache.h>
#include <linux/proc_fs.h>
#include <linux/seq_file.h>

MODULE_LICENSE("Dual MIT/GPL");
MODULE_AUTHOR("Ryan Eberhardt");
MODULE_DESCRIPTION("Cplayground debugging module");
MODULE_VERSION("0.01");

static struct proc_dir_entry *cplayground_dirent = NULL;

// Most of this hashing code is stolen from
// https://www.kernel.org/doc/html/v4.17/crypto/api-samples.html
struct sdesc {
    struct shash_desc shash;
    char ctx[];
};

static struct sdesc *init_sdesc(struct crypto_shash *alg)
{
    struct sdesc *sdesc;
    int size;

    size = sizeof(struct shash_desc) + crypto_shash_descsize(alg);
    sdesc = kmalloc(size, GFP_KERNEL);
    if (!sdesc)
        return ERR_PTR(-ENOMEM);
    sdesc->shash.tfm = alg;
    return sdesc;
}

static int calc_hash(struct crypto_shash *alg,
             const unsigned char *data, unsigned int datalen,
             unsigned char *digest)
{
    struct sdesc *sdesc;
    int ret;

    sdesc = init_sdesc(alg);
    if (IS_ERR(sdesc)) {
        pr_info("can't alloc sdesc\n");
        return PTR_ERR(sdesc);
    }

    ret = crypto_shash_digest(&sdesc->shash, data, datalen, digest);
    kfree(sdesc);
    return ret;
}

static int test_hash(const unsigned char *data, unsigned int datalen,
             unsigned char *digest)
{
    struct crypto_shash *alg;
    char *hash_alg_name = "sha256";
    int ret;

    alg = crypto_alloc_shash(hash_alg_name, 0, 0);
    if (IS_ERR(alg)) {
            pr_info("can't alloc alg %s\n", hash_alg_name);
            return PTR_ERR(alg);
    }
    ret = calc_hash(alg, data, datalen, digest);
    crypto_free_shash(alg);
    return ret;
}

static void hash_pointer(void *ptr, char *hash_buf) {
    u8 hashval[32];
    if (test_hash((char*)&ptr, sizeof(void*), hashval) < 0) {
        pr_info("cplayground: error hashing\n");
        return;
    }
    for (int i = 0; i < 32; i++) {
        sprintf(hash_buf + i * 2, "%02x", hashval[i]);
    }
}

/**
 * A bunch of this code is plagarized from seq_show in fs/proc/fd.c (the code
 * responsible for writing the contents of /proc/pid/fd/num).
 */
static void inspect_fd(int fd, struct file *file, int cloexec,
        struct seq_file *sfile) {
    char path_buf[512];
    char* path_str = file_path(file, path_buf, sizeof(path_buf));

    char file_ptr_hash[64 + 1];
    hash_pointer(file, file_ptr_hash);

    // TODO: need to lock before getting f_pos? fs/proc/fd.c doesn't do it...
    seq_printf(sfile,
            "%d\t"      // fd
            "%d\t"      // close_on_exec
            "%s\t"      // open file id (file_ptr_hash)
            "%lli\t"    // file position/offset
            "0%o\t"     // flags
            "%s\n",     // vnode id (path_str)
            fd, cloexec, file_ptr_hash, (long long)file->f_pos, file->f_flags,
            path_str);
}

/**
 * A bunch of this code is plagarized from seq_show in fs/proc/fd.c (the code
 * responsible for writing the contents of /proc/pid/fd/num).
 */
static void inspect_fds(struct files_struct *files, struct seq_file *sfile) {
    spin_lock(&files->file_lock);

    for (int fd = 0; fd < files_fdtable(files)->max_fds; fd++) {
        struct file *file = fcheck_files(files, fd);
        if (file) {
            // Get everything we need before releasing the spinlock
            struct fdtable *fdt = files_fdtable(files);
            int cloexec = close_on_exec(fd, fdt);
            // Increment kernel refcount on the file so it isn't deallocated
            // while we're using it
            get_file(file);
            spin_unlock(&files->file_lock);

            inspect_fd(fd, file, cloexec, sfile);

            spin_lock(&files->file_lock);
            // Decrement refcount on file
            fput(file);
        }
    }

    spin_unlock(&files->file_lock);
}

static void print_proc_details(void *ns_ptr, int global_pid, int container_pid,
        int container_ppid, int container_pgid, char run_state, const char *command,
        struct seq_file *sfile) {
    char ns_ptr_hash[64 + 1];
    hash_pointer(ns_ptr, ns_ptr_hash);

    seq_printf(sfile,
            "%s\t"  // namespace ID (i.e. hash of pid_namespace pointer)
            "%d\t"  // global PID
            "%d\t"  // container PID
            "%d\t"  // container PPID
            "%d\t"  // container PGID
            "%c\t"  // run state
            "%s\n", // command
            ns_ptr_hash, global_pid, container_pid, container_ppid,
            container_pgid, run_state, command);
}

/**
 * This function populates a list of containerized task structs, and returns
 * the length of the list.  The kernel reference count is incremented on each
 * of the tasks that are placed in this list, so that they don't get
 * deallocated before we have a chance to do something with them. You MUST call
 * put_task_struct on each of these tasks to avoid leaking memory.
 */
static unsigned int get_containerized_processes(
        struct task_struct **container_tasks,
        unsigned int max_container_tasks) {
    task_lock(&init_task);
    struct pid_namespace *init_ns = init_task.nsproxy->pid_ns_for_children;
    task_unlock(&init_task);

    // Loop through all processes, looking for processes whose pid_namespace
    // differ from the pid_namespace of the init process (indicating that those
    // processes are likely containerized)
    int container_tasks_len = 0;
    struct task_struct *task;
    rcu_read_lock();    // begin critical section, do not sleep!
    for_each_process(task) {
        task_lock(task);

        struct pid_namespace *ns = task_active_pid_ns(task);
        if (ns == init_ns) {
            task_unlock(task);
            continue;
        }
        // This is a containerized process!
        get_task_struct(task);
        task_unlock(task);

        container_tasks[container_tasks_len++] = task;
        if (container_tasks_len == max_container_tasks) {
            printk("cplayground: ERROR: container_tasks list hit capacity! We "
                "may be missing processes from the procfile output.\n");
            break;
        }
    }
    rcu_read_unlock();  // end rcu critical section
    return container_tasks_len;
}

/**
 * Gets the run state of a process, as is reported by ps and /proc/##/status.
 * Returns the friendly single-character representation as opposed to the bitflag.
 */
static char get_proc_runstatus(struct task_struct *task) {
    unsigned int friendly_state_id = task_state_index(task);
    return task_index_to_char(friendly_state_id);
}

/**
 * This function prints info to the procfile for each process in
 * container_tasks. It also calls put_task_struct on each task in the list, so
 * the memory is released.
 */
static void print_processes(struct task_struct **container_tasks, unsigned int container_tasks_len,
        struct seq_file *sfile) {
    for (unsigned int i = 0; i < container_tasks_len; i++) {
        struct task_struct *task = container_tasks[i];

        if (seq_has_overflowed(sfile)) {
            // We wrote more output to the procfile than seqfile had allocated
            // space for.  seqfile will allocate a bigger buffer, then call us
            // again to populate it.  Since it's already going to discard our
            // output, no use producing more.
            put_task_struct(task);
            continue;
        }

        // Begin critical region. The task lock is a spinlock so be sure to not
        // sleep.
        task_lock(task);
        int global_pid = task_pid_nr(task);

        struct pid_namespace *ns = task_active_pid_ns(task);
        int container_pid = task_pid_nr_ns(task, ns);
        int container_ppid = task_ppid_nr_ns(task, ns);
        int container_pgid = task_pgrp_nr_ns(task, ns);
        char run_state = get_proc_runstatus(task);
        unsigned char command[sizeof(task->comm)];
        strncpy(command, task->comm, sizeof(task->comm));
        task_unlock(task);
        // End critical region

        // TODO: get_files_struct re-acquires the task_lock. Any way to make
        // this more efficient?
        struct files_struct *files = get_files_struct(task);
        put_task_struct(task);
        // Ensure no code uses the task struct after this point, since it may
        // be deallocated

        print_proc_details((void*)ns, global_pid, container_pid,
                container_ppid, container_pgid, run_state, command, sfile);

        if (files) {
            inspect_fds(files, sfile);
            put_files_struct(files);
        }

        seq_printf(sfile, "\n");
    }
}

static int ct_seq_show(struct seq_file *sfile, void *v) {
    printk("cplayground: generating procfile\n");

    const unsigned int max_container_tasks = 4096;  // 16 pids/container * 256 containers
    struct task_struct **container_tasks = kmalloc(
        max_container_tasks * sizeof(struct task_struct *), GFP_KERNEL);
    if (container_tasks == NULL) {
        printk("cplayground: ERROR: failed to alloc memory for container task pointers\n");
        return -ENOMEM;
    }

    unsigned int container_tasks_len =
        get_containerized_processes(container_tasks, max_container_tasks);
    printk("cplayground: found %d containerized processes\n",
            container_tasks_len);
    print_processes(container_tasks, container_tasks_len, sfile);
    kfree(container_tasks);
    printk("cplayground: finished generating procfile\n");
    return 0;
}

static int ct_open(struct inode *inode, struct file *file) {
    printk("cplayground: opening file\n");
    return single_open(file, ct_seq_show, NULL);
}

static struct file_operations cplayground_file_ops = {
	.owner = THIS_MODULE,
    .open    = ct_open,
    .read    = seq_read,
    .llseek  = seq_lseek,
    .release = single_release,
};

static int __init lkm_example_init(void) {
    printk(KERN_INFO "cplayground: loading kernel module\n");
    cplayground_dirent = proc_create("cplayground", 0400, NULL, &cplayground_file_ops);
    if (cplayground_dirent == NULL) {
        return -ENOMEM;
    }
    // TODO: Don't hardcode uid 1000
    kuid_t uid = { .val = 1000 };
    kgid_t gid = { .val = 1000 };
    proc_set_user(cplayground_dirent, uid, gid);
    return 0;
}

static void __exit lkm_example_exit(void) {
    printk(KERN_INFO "cplayground: unloading kernel module\n");
    proc_remove(cplayground_dirent);
}

module_init(lkm_example_init);
module_exit(lkm_example_exit);

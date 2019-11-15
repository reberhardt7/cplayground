#include <linux/init.h>
#include <linux/module.h>
#include <linux/kernel.h>
#include <linux/sched.h>            // for_each_process, pr_info
#include <linux/sched/signal.h>     // for_each_process, pr_info
#include <linux/nsproxy.h>          // struct nsproxy
#include <linux/fdtable.h>
#include <linux/file.h>
#include <linux/crypto.h>
#include <crypto/hash.h>
#include <asm/atomic.h>
#include <linux/dcache.h>
#include <linux/proc_fs.h>
#include <linux/fs.h>
#include <linux/seq_file.h>

MODULE_LICENSE("Dual MIT/GPL");
MODULE_AUTHOR("Ryan Eberhardt");
MODULE_DESCRIPTION("Cplayground debugging module");
MODULE_VERSION("0.01");

const int kFileBufSize = 1024 * 8;

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
static void inspect_fd(struct fdtable *fdt, int fd, struct file *file,
        struct seq_file *sfile) {
    int f_flags = file->f_flags;
    if (close_on_exec(fd, fdt))
        f_flags |= O_CLOEXEC;

    // TODO: locks?
    char path_buf[512];
    char* path_str = d_path(&file->f_path, path_buf, sizeof(path_buf));

    char file_ptr_hash[64 + 1];
    hash_pointer(file, file_ptr_hash);

    // TODO: need to lock before getting f_pos?
    seq_printf(sfile,
            "fd:\t%d\n"
            "close_on_exec:\t%d\n"
            "open_file:\t%s\n"
            "pos:\t%lli\n"
            "flags:\t0%o\n"
            "vnode:\t%s\n",
            fd, close_on_exec(fd, fdt), file_ptr_hash, (long long)file->f_pos,
            f_flags, path_str);
}

/**
 * A bunch of this code is plagarized from seq_show in fs/proc/fd.c (the code
 * responsible for writing the contents of /proc/pid/fd/num).
 */
static void inspect_fds(struct files_struct *files, struct seq_file *sfile) {
    // TODO: is this necessary? Isn't there some mention of RCU?
    spin_lock(&files->file_lock);

    for (int fd = 0; fd < files_fdtable(files)->max_fds; fd++) {
        // TODO: what exactly does fcheck_files do?
        struct file *file = fcheck_files(files, fd);
        if (file) {
            struct fdtable *fdt = files_fdtable(files);
            // TODO: what is this doing? is fput releasing?
            get_file(file);

            inspect_fd(fdt, fd, file, sfile);

            fput(file);
        }
    }

    spin_unlock(&files->file_lock);
}

static void inspect_proc(struct task_struct *task, struct pid_namespace *ns,
        struct seq_file *sfile) {
    seq_printf(sfile, "== %s [%d / %d]\n",
            task->comm, task_pid_nr(task), task_pid_nr_ns(task, ns));
    // TODO: get_files_struct is undefined?
    //files = get_files_struct(task);
    // TODO: I don't think we need to increment the refcount here since
    // we're holding the lock for the whole duration
    struct files_struct *files = task->files;
    if (files) {
        inspect_fds(files, sfile);
    }
    seq_printf(sfile, "\n");
    // TODO: put_files_struct is undefined?
    //put_files_struct(files);
}

static int ct_seq_show(struct seq_file *sfile, void *v) {
    printk("cplayground: in ct_seq_show\n");
    // Loop through all processes, looking for processes whose pid_namespace
    // differ from the pid_namespace of the init process (indicating that those
    // processes are likely containerized)
    // TODO: only loop through the processes that are in containers of
    // interest. (This gets us all containerized processes, which is a little
    // too permissive)
    task_lock(&init_task);
    struct pid_namespace *init_ns = init_task.nsproxy->pid_ns_for_children;
    task_unlock(&init_task);

    struct task_struct *task;
    for_each_process(task) {
        task_lock(task);
        // TODO: need to get_task_lock?

        struct nsproxy *nsproxy = task->nsproxy;
        if (nsproxy == NULL) {  // indicates zombie process, according to docs
            task_unlock(task);
            continue;
        }
        struct pid_namespace *ns = nsproxy->pid_ns_for_children;
        if (ns == init_ns) {
            task_unlock(task);
            continue;
        }

        inspect_proc(task, ns, sfile);

        task_unlock(task);
    }
    return 0;
}

static int ct_open(struct inode *inode, struct file *file) {
    printk("cplayground: in ct_open\n");
    // TODO: see if it's worth implementing the full iterator interface
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
    // TODO: make this file readable by unprivileged user
    return 0;
}

static void __exit lkm_example_exit(void) {
    printk(KERN_INFO "cplayground: unloading kernel module\n");
    proc_remove(cplayground_dirent);
}

module_init(lkm_example_init);
module_exit(lkm_example_exit);

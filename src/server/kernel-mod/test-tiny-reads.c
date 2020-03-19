/**
 * This file is intended to test that seq_file is doing the right thing, and
 * that we can read big proc files that span many `read` calls. (We just make
 * tiny read calls here.)
 */

#include <unistd.h>
#include <fcntl.h>
#include <sys/stat.h>
#include <stdio.h>

int main() {
	int fd = open("/proc/cplayground", O_RDONLY);
	while (1) {
		char buf[16];
		int num_read = read(fd, buf, sizeof(buf));
		if (num_read < 0) {
			fprintf(stderr, "Error, read returned %d\n", num_read);
		}
		if (num_read == 0) {
			break;
		}
		fprintf(stderr, "%.*s", num_read, buf);
		sleep(1);
	}
	fprintf(stderr, "\n");
	return 0;
}

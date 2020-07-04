cplayground
===========

[cplayground.com](https://cplayground.com)

CPlayground is an online sandbox that makes it easy to quickly test out C or
C++ code. A specific goal of the project is to offer strong support for OS
constructs such as multiprocessing and multithreading.

Build instructions
------------------

I have only tested these instructions on Ubuntu, but they should work on other
Linux flavors with modification.

**Install NodeJS:**

```
curl -sL https://deb.nodesource.com/setup_11.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Install and configure Docker:**

```
sudo apt install apt-transport-https ca-certificates curl software-properties-common
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu bionic stable"
sudo apt update
sudo apt install docker-ce
```

You will probably want to add the user running cplayground to the `docker` group,
so that you don't need to run the server as root:

```
sudo usermod -aG docker $USER
```

In order to support memory limits on containers (highly recommended to limit
DDoS attacks), you need to edit `/etc/default/grub` and modify the
`GRUB_CMDLINE_LINUX` variable:

```
GRUB_CMDLINE_LINUX="cgroup_enable=memory swapaccount=1"
```

Then:

```
sudo update-grub
sudo reboot
```

**Install project dependencies and build:**

```
sudo apt-get install -y build-essential make
cd cplayground/
yarn install
sudo docker build -t cplayground src/server/docker-image/
yarn run build
```

Create a MySQL database called `cplayground` and add a user for this database.
Then run the server:

```
export DB_URL="mysql://username:password@localhost"
node src/server/migrations.js up
yarn run serve
```

# -*- mode: ruby -*-
# vi: set ft=ruby :

# All Vagrant configuration is done below. The "2" in Vagrant.configure
# configures the configuration version (we support older styles for
# backwards compatibility). Please don't change it unless you know what
# you're doing.
Vagrant.configure("2") do |config|
  # Use Ubuntu 18.04
  config.vm.box = "hashicorp/bionic64"

  # Forward host port 3000 to guest port 3000. That way, if you navigate to
  # localhost:3000, it will load cplayground from the vm. Also forward the nodejs debug port.
  config.vm.network "forwarded_port", guest: 3000, host: 3000, host_ip: "127.0.0.1"
  config.vm.network "forwarded_port", guest: 9229, host: 9229, host_ip: "127.0.0.1"

  # Mount ./ from the host (i.e. the cplayground directory) to /cplayground in
  # the vm
  config.vm.synced_folder "./", "/cplayground"
  config.vm.synced_folder "./", "/vagrant", disabled: true

  # Provider-specific configuration so you can fine-tune various
  # backing providers for Vagrant. These expose provider-specific options.
  config.vm.provider "virtualbox" do |vb|
    # Customize the amount of memory on the VM:
    vb.memory = "2048"
  end

  # Analogous configuration for libvirt. Note that our base box doesn't support
  # libvirt (and Vagrant needs a plugin to support libvirt), so one might want
  # to look at vagrant-migrate and vagrant-libvirt respectively for that purpose.
  # You might prefer libvirt if you already have it running as a hypervisor and
  # don't want to run VirtualBox in addition to it, most likely on Linux.
  config.vm.provider "libvirt" do |lv|
    # Customize the amount of memory on the VM:
    lv.memory = "2048"
  end

  # Automatically configure timezone: https://stackoverflow.com/a/46778032
  require 'time'
  offset = ((Time.zone_offset(Time.now.zone) / 60) / 60)
  timezone_suffix = offset >= 0 ? "-#{offset.to_s}" : "+#{(offset * -1).to_s}"
  timezone = 'Etc/GMT' + timezone_suffix
  config.vm.provision :shell, :inline => "sudo rm /etc/localtime && sudo ln -s /usr/share/zoneinfo/" + timezone + " /etc/localtime", run: "always"

  # Install and configure Mysql 8
  # Adapted from https://github.com/troysandal/mysql8-vagrant/blob/master/provision.sh
  config.vm.provision "shell", inline: <<-SHELL
    echo -e "\e[96m""Installing mysql8...""\e[0m"
    # Add package repository
    wget https://dev.mysql.com/get/mysql-apt-config_0.8.15-1_all.deb -O mysql-apt-config.deb
    sudo debconf-set-selections <<< 'mysql-apt-config mysql-apt-config/select-server select mysql-8.0'
    DEBIAN_FRONTEND="noninteractive" sudo -E dpkg -i mysql-apt-config.deb
    sudo apt-get update

    # Do install
    sudo debconf-set-selections <<< 'mysql-server mysql-server/root_password password root'
    sudo debconf-set-selections <<< 'mysql-server mysql-server/root_password_again password root'
    DEBIAN_FRONTEND="noninteractive" sudo -E apt-get -y install mysql-server

    # Create cplayground user and database. (Really, we should be using a
    # random password here. It would be pretty easy to do: Generate a random
    # password, create user using that password, and save "export DB_URL=..."
    # to .bash_profile. But the password would change every time we recreate
    # the vm, which might make it annoying to attach an external database
    # viewer, and this user is only accessible within the vm anyways, and
    # there's no sensitive data, so I don't think the security concerns are
    # significant.)
    echo -e "\e[96m""Configuring cplayground database...""\e[0m"
    sudo mysql -u root -e "
      CREATE USER 'cplayground'@'localhost'
      IDENTIFIED WITH mysql_native_password BY 'cplayground';
      CREATE DATABASE cplayground;
      GRANT ALL PRIVILEGES ON cplayground.* TO 'cplayground'@'localhost';
      FLUSH PRIVILEGES;
    "

    echo 'export DB_URL="mysql://cplayground:cplayground@localhost"' >> .bash_profile
  SHELL

  # Set up dependencies
  config.vm.provision "shell", inline: <<-SHELL
    cd /cplayground
    sudo -Hu vagrant ./install-deps.sh
  SHELL

  # Reboot to load the new grub configuration and kernel
  config.vm.provision :reload

  # Build the project
  config.vm.provision "shell", inline: <<-SHELL
    cd /cplayground
    rm -rf node_modules
    export DB_URL="mysql://cplayground:cplayground@localhost"
    sudo -EHu vagrant ./build-all.sh
  SHELL

  # Load cplayground kernel module - do this every boot
  config.vm.provision "shell", run: 'always', inline: <<-SHELL
    # Mount the kernel module
    echo -e "\e[96m""Mounting kernel module...""\e[0m"
    if lsmod | grep -q 'cplayground'; then
        rmmod cplayground
    fi
    (
      cd /cplayground/src/server/kernel-mod
      sudo insmod cplayground.ko "file_uid=$(id -u vagrant)" "file_gid=$(id -g vagrant)"
    )
  SHELL

  # Finish up with vagrant-specific vm prep
  config.vm.provision "shell", inline: <<-SHELL
    # Virtualbox shared folders don't support unix domain sockets (which we use
    # to communicate with gdb in the Docker containers). As a hack, we put the
    # data folder in the parent directory so that it's not in the shared
    # folder, then symlink to it from inside the shared folder.
    echo -e "\e[96m""Symlinking data directory to /cplayground-data...""\e[0m"
    rm -rf /cplayground/data
    mkdir /cplayground-data
    chown vagrant:vagrant /cplayground-data
    ln -s /cplayground-data /cplayground/data

    # Set the default workdir
    echo -e "\e[96m""Setting default workdir to /cplayground...""\e[0m"
    echo "cd /cplayground" >> .bash_profile

    echo -e "\e[96m""All done!""\e[0m"
  SHELL
end

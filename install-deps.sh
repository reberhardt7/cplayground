#! /bin/bash

set -e

# Install build dependencies
echo -e "\e[96m""Installing build dependencies...""\e[0m"
sudo apt-get update
sudo apt-get install -y build-essential make

# Install nodejs 14
echo -e "\e[96m""Installing NodeJS...""\e[0m"
curl -sL https://deb.nodesource.com/setup_14.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install yarn
curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list
sudo apt update && sudo apt install yarn

# Install Docker
echo -e "\e[96m""Installing Docker...""\e[0m"
sudo apt-get install -y apt-transport-https ca-certificates curl software-properties-common
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu bionic stable"
sudo apt-get update
sudo apt-get install -y docker-ce
sudo groupadd -f docker
sudo usermod -aG docker $USER

# Enable memory limits for Docker contianers
echo -e "\e[96m""Enabling memory limits in grub config...""\e[0m"
echo 'GRUB_CMDLINE_LINUX="$GRUB_CMDLINE_LINUX cgroup_enable=memory swapaccount=1"' \
    | sudo tee -a /etc/default/grub
sudo update-grub
# NOTE: this requires a reboot

# Install custom Cplayground kernel
echo -e "\e[96m""Installing custom cplayground Linux kernel...""\e[0m"
sudo apt-get install -y linux-tools-common linux-cloud-tools-common libdw1
sudo dpkg -i src/server/kernel/linux-*.deb
# NOTE: this requires a reboot

echo -e "\e[96m""All done! Please remember to reboot.""\e[0m"

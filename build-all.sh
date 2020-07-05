#! /bin/bash

set -e

# Build the kernel module. (The parentheses spawn a subshell, so that we can
# "cd" temporarily and then resume the rest of this script from the original
# working directory.)
echo -e "\e[96m""Building cplayground kernel module...""\e[0m"
uname -sr
(
    cd src/server/kernel-mod
    make
)

# Build the docker container
echo -e "\e[96m""Building Docker container...""\e[0m"
sudo docker build -t cplayground src/server/docker-image/

# Build the js application
echo -e "\e[96m""Installing Javascript dependencies..""\e[0m"
yarn install
echo -e "\e[96m""Building Javascript application...""\e[0m"
yarn run build
echo -e "\e[96m""Running database migrations...""\e[0m"
node src/server/migrations.js up

#! /bin/bash

set -e
cd "$(dirname "${BASH_SOURCE[0]}")"

VERSION=5.3.0
VERSION_FULL=5.3.0-42-generic

sudo apt-get build-dep linux linux-image-$VERSION_FULL
sudo apt-get install libncurses-dev flex bison openssl libssl-dev dkms libelf-dev libudev-dev libpci-dev libiberty-dev autoconf

apt-get source linux-source-$VERSION
cd linux-hwe-$VERSION
patch -p0 < ../cplayground.patch

fakeroot debian/rules clean
fakeroot debian/rules binary-headers binary-generic binary-perarch

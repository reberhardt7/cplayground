#! /bin/bash

set -e

echo -e "\e[100m\e[96m                    Compiling...                    \e[0m"
gcc -o /compiled /code.c
echo -e "\e[100m\e[96m                    Executing...                    \e[0m"
/compiled

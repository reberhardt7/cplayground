#! /bin/bash

# TODO: in the future, make BANNER_WIDTH dependent on the size of the terminal.
# (This might be tricky; there seems to be a race condition with docker or
# node-pty or something where the terminal size isn't being correctly set until
# after this script already starts running.)
BANNER_WIDTH=60
GREEN="\e[92m"
YELLOW="\e[93m"
CYAN="\e[96m"
LIGHT_GRAY="\e[100m"

# Syntax: print_banner <str> <fg color> <bg color>
function print_banner {
    STR_LEN=${#1}
    LPAD_LEN=$((($BANNER_WIDTH-$STR_LEN)/2))
    RPAD_LEN=$((($BANNER_WIDTH-$STR_LEN+1)/2))
    printf "$2$3"
    printf '%*s' $LPAD_LEN ''
    printf "$1"
    printf '%*s' $RPAD_LEN ''
    printf "\e[0m\n"
}

# Syntax: format_execution_time <start time in ns> <end time in ns>
# Returns $RUN_TIME
function format_execution_time {
    RUN_TIME_NS=$(($2 - $1))
    if [ $RUN_TIME_NS -gt 1000000000 ]; then
        RUN_TIME_S=$(bc <<< "scale = 10; $RUN_TIME_NS / 1000000000")
        RUN_TIME="$(printf %.3f $RUN_TIME_S) seconds"
    else
        RUN_TIME_MS=$(bc <<< "scale = 10; $RUN_TIME_NS / 1000000")
        RUN_TIME="$(printf %.3f $RUN_TIME_MS) ms"
    fi
}

# Precompute the successful "Execution finished" banner so that when execution
# finishes, we can print these as fast as possible. (This is because I want to
# be able to show race conditions where users' code doesn't properly wait for
# child processes that they spawn, and the output of children comes after the
# parent exits. To do that, this script needs to print before the child
# processes do.)
SUCCESS_EXIT_BANNER=$(print_banner \
    "Execution finished (exit status 0)" \
    $GREEN $LIGHT_GRAY)

# Compile and run the user program
print_banner "Compiling..." $CYAN $LIGHT_GRAY
START_COMP_TIME_NS=$(date +%s%N)
gcc -o /cppfiddle/output /cppfiddle/code.c              \
    && END_COMP_TIME_NS=$(date +%s%N)                   \
    && format_execution_time $START_COMP_TIME_NS $END_COMP_TIME_NS  \
    && print_banner "Compiled in $RUN_TIME" $GREEN $LIGHT_GRAY      \
    && print_banner "Executing..." $CYAN $LIGHT_GRAY    \
    && START_EXEC_TIME_NS=$(date +%s%N)                 \
    && /cppfiddle/output
STATUS_CODE=$?
END_EXEC_TIME_NS=$(date +%s%N)

# Print the final banner
if [ $STATUS_CODE = 0 ]
then
    DONE_BANNER_COLOR=$GREEN
    printf "$SUCCESS_EXIT_BANNER\n"
else
    DONE_BANNER_COLOR=$YELLOW
    print_banner "Execution finished (exit status $STATUS_CODE)" \
        $YELLOW $LIGHT_GRAY
fi

if [ -n "$START_EXEC_TIME_NS" ]
then
    format_execution_time $START_EXEC_TIME_NS $END_EXEC_TIME_NS
    print_banner "Executed in $RUN_TIME" $DONE_BANNER_COLOR $LIGHT_GRAY
fi

# Wait for 0.1 seconds to give any lingering child processes a chance to print
sleep 0.1

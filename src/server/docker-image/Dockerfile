# this is a multi-stage docker build
# start by building the sandbox wrapper application written in C
# use a gcc image separate from the main image so we don't leave sandbox build clutter in the target
FROM gcc:10.2.0 AS sandbox-build
COPY sandbox /usr/src/cplayground_sandbox
WORKDIR /usr/src/cplayground_sandbox
RUN gcc -o /usr/bin/cplayground_sandbox main.c

# build the target image for running the user application
FROM ubuntu:latest
RUN apt-get update && \
    DEBIAN_FRONTEND="noninteractive" apt-get install -y apt-utils build-essential bc unzip nsnake python3 gdb libreadline-dev flex bison cowsay fortune

RUN groupadd -g 999 cplayground \
    && useradd -r -u 999 -g cplayground -d /cplayground cplayground

COPY run.py /run.py
COPY --from=sandbox-build /usr/bin/cplayground_sandbox /sandbox
RUN mkdir -p /cplayground \
    && chmod 777 /cplayground \
    && chown -R cplayground:cplayground /cplayground \
    && chmod +x run.py \
    && chmod +x sandbox

USER cplayground
WORKDIR /cplayground
CMD ["/run.py"]

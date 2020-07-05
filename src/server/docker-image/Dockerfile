FROM ubuntu:latest
RUN apt-get update && \
    DEBIAN_FRONTEND="noninteractive" apt-get install -y apt-utils build-essential bc unzip nsnake python3 gdb

RUN groupadd -g 999 cplayground \
    && useradd -r -u 999 -g cplayground -d /cplayground cplayground

ADD run.py /run.py
RUN mkdir -p /cplayground \
    && chmod 777 /cplayground \
    && chown -R cplayground:cplayground /cplayground \
    && chmod +x run.py

USER cplayground
WORKDIR /cplayground
CMD ["/run.py"]

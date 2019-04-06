FROM ubuntu:latest
RUN apt-get update && apt-get install -y apt-utils build-essential bc unzip nsnake

RUN groupadd -g 999 cplayground \
    && useradd -r -u 999 -g cplayground -d /cplayground cplayground

ADD run.sh /run.sh
RUN mkdir -p /cplayground \
    && chmod 777 /cplayground \
    && chown -R cplayground:cplayground /cplayground \
    && chmod +x run.sh

USER cplayground
WORKDIR /cplayground
CMD ["/run.sh"]

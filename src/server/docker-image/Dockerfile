FROM ubuntu:latest
RUN apt-get update && apt-get install -y apt-utils build-essential bc nsnake

RUN groupadd -g 999 cppfiddle \
    && useradd -r -u 999 -g cppfiddle -d /cppfiddle cppfiddle

ADD run.sh /run.sh
RUN mkdir -p /cppfiddle \
    && chmod 777 /cppfiddle \
    && chown -R cppfiddle:cppfiddle /cppfiddle \
    && chmod +x run.sh

USER cppfiddle
WORKDIR /cppfiddle
CMD ["/run.sh"]

FROM ubuntu:latest
RUN apt-get update && apt-get install -y apt-utils build-essential

RUN groupadd -g 999 cppfiddle && \
    useradd -r -u 999 -g cppfiddle cppfiddle

RUN mkdir /cppfiddle
ADD run.sh /cppfiddle/run.sh
RUN chown -R cppfiddle:cppfiddle /cppfiddle && chmod +x /cppfiddle/run.sh

USER cppfiddle
CMD ["/cppfiddle/run.sh"]

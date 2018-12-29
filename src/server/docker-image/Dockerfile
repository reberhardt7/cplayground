FROM ubuntu:latest
RUN apt-get update && apt-get install -y apt-utils build-essential bc nsnake

RUN groupadd -g 999 cppfiddle \
    && useradd -r -u 999 -g cppfiddle cppfiddle \
    && echo "cppfiddle hard cpu 0.25" >> /etc/security/limits.conf \
    && echo "cppfiddle hard nproc 32" >> /etc/security/limits.conf \
    && echo "cppfiddle hard nofile 1024" >> /etc/security/limits.conf

RUN mkdir /cppfiddle
ADD run.sh /cppfiddle/run.sh
RUN chown -R cppfiddle:cppfiddle /cppfiddle && chmod +x /cppfiddle/run.sh

USER cppfiddle
CMD ["/cppfiddle/run.sh"]

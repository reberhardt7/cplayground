FROM ubuntu:latest
RUN apt-get update && apt-get install -y apt-utils build-essential bc nsnake

RUN groupadd -g 999 cfiddle \
    && useradd -r -u 999 -g cfiddle -d /cfiddle cfiddle

ADD run.sh /run.sh
RUN mkdir -p /cfiddle \
    && chmod 777 /cfiddle \
    && chown -R cfiddle:cfiddle /cfiddle \
    && chmod +x run.sh

USER cfiddle
WORKDIR /cfiddle
CMD ["/run.sh"]

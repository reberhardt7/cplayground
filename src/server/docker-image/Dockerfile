FROM ubuntu:20.04
RUN apt-get update && \
    DEBIAN_FRONTEND="noninteractive" apt-get install -y apt-utils build-essential gcc-10 g++-10 bc unzip nsnake python3 gdb libreadline-dev flex bison cowsay fortune

# gcc9 is currently the default in ubuntu 12.04. Use gcc10 for better c++20 support
RUN update-alternatives --install /usr/bin/gcc gcc /usr/bin/gcc-10 10 && \
    update-alternatives --install /usr/bin/g++ g++ /usr/bin/g++-10 10

RUN groupadd -g 999 cplayground \
    && useradd -r -u 999 -g cplayground -d /cplayground cplayground

ADD run.py /run.py
RUN mkdir -p /cplayground \
    && chmod 777 /cplayground \
    && chown -R cplayground:cplayground /cplayground \
    && chmod +x run.py

USER cplayground
WORKDIR /cplayground
ENV PATH="${PATH}:/usr/games"
CMD ["/run.py"]

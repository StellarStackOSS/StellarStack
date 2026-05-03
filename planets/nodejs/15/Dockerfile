FROM        --platform=$TARGETOS/$TARGETARCH node:15-alpine

LABEL       maintainer="matthew@stellarstack.io"

LABEL       org.opencontainers.image.source="https://github.com/stellarstack/yolks"
LABEL       org.opencontainers.image.licenses=MIT

RUN         apk add --update --no-cache ca-certificates curl ffmpeg git openssl sqlite tar tzdata \
				&& adduser -D -h /home/container container

USER        container
ENV         USER=container HOME=/home/container
WORKDIR     /home/container

COPY        ./../entrypoint.sh /entrypoint.sh
CMD         [ "/bin/ash", "/entrypoint.sh" ]

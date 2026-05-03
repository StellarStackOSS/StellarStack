FROM        --platform=$TARGETOS/$TARGETARCH golang:1.25-alpine

LABEL       maintainer="matthew@stellarstack.io"

LABEL       org.opencontainers.image.source="https://github.com/stellarstack/yolks"
LABEL       org.opencontainers.image.licenses=MIT

#hadolint ignore=DL3018
RUN         apk add --update --no-cache ca-certificates tzdata


ENV         USER=container HOME=/home/container
ENV         GOMODCACHE=/home/container/.go-modcache
WORKDIR     /home/container

COPY		--chmod=755 --chown=root:root ../entrypoint.sh /entrypoint.sh
ENTRYPOINT	["/entrypoint.sh"]

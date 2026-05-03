FROM        --platform=$TARGETOS/$TARGETARCH golang:1.18-alpine

LABEL       maintainer="matthew@stellarstack.io"

LABEL       org.opencontainers.image.source="https://github.com/stellarstack/yolks"
LABEL       org.opencontainers.image.licenses=MIT

RUN         apk add --update --no-cache ca-certificates tzdata \
			&& adduser -D -h /home/container container

USER        container
ENV         USER=container HOME=/home/container
WORKDIR     /home/container

ENV			YOLK_EOL_NAG_WARNING=1

COPY		--chmod=755 --chown=root:root ../entrypoint.sh /entrypoint.sh
ENTRYPOINT	["/entrypoint.sh"]

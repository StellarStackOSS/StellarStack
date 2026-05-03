FROM 		--platform=$TARGETOS/$TARGETARCH ghcr.io/stellarstack/yolks:java_25

LABEL       maintainer="william.venner@infraly.co"

LABEL       org.opencontainers.image.source="https://github.com/stellarstack/yolks"
LABEL       org.opencontainers.image.licenses=MIT

USER		root

COPY        --from=ghcr.io/stellarstack/yolks:java_25 entrypoint.sh /java.sh
RUN 		chmod +x /java.sh

RUN			apt-get update -y \
				&& apt-get install -y unzip jq \
				&& rm -rf /var/lib/apt/lists/*

USER        container
ENV         USER=container HOME=/home/container
WORKDIR     /home/container

COPY 		./entrypoint.sh /entrypoint.sh

CMD         [ "/bin/bash", "/entrypoint.sh" ]

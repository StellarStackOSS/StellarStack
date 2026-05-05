# Multi-stage build for the StellarStack daemon.
#
# Stage 1 — golang:1.23-alpine, CGO_ENABLED=0 static build.
# Stage 2 — alpine runtime, plus a tini for clean signal handling. The
# daemon talks to the host's Docker socket, which is bind-mounted by the
# compose file at /var/run/docker.sock.
#
# Build:
#   docker build -f apps/daemon/Dockerfile -t ghcr.io/stellarstackoss/daemon:latest apps/daemon

# ---------- Stage 1: build ----------
FROM golang:1.23-alpine AS build

WORKDIR /src

# Module deps first for layer cache.
COPY go.mod go.sum ./
RUN go mod download

COPY . .

ARG TARGETOS=linux
ARG TARGETARCH=amd64
ARG VERSION=dev
ARG COMMIT=unknown

RUN CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} \
    go build \
      -trimpath \
      -ldflags "-s -w -X main.version=${VERSION} -X main.commit=${COMMIT}" \
      -o /out/stellar-daemon \
      ./cmd/stellar-daemon

# ---------- Stage 2: runtime ----------
FROM alpine:3.20 AS runtime

RUN apk add --no-cache ca-certificates tini

COPY --from=build /out/stellar-daemon /usr/local/bin/stellar-daemon

# Sensible default; the compose file overrides it via --data-dir.
ENV DATA_DIR=/var/lib/stellarstack

EXPOSE 8443
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/stellar-daemon"]
CMD ["start", "--data-dir", "/var/lib/stellarstack"]

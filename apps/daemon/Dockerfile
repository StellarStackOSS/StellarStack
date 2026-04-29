ARG GO_VERSION=1.26

FROM golang:${GO_VERSION}-bookworm AS build
WORKDIR /src
COPY apps/daemon/go.mod ./
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go mod download
COPY apps/daemon ./
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux \
    go build -ldflags="-s -w -X github.com/stellarstack/daemon/internal/config.Version=$(date +%Y%m%d.%H%M%S)" \
    -o /out/stellar-daemon ./cmd/stellar-daemon

FROM gcr.io/distroless/static-debian12:nonroot AS runtime
COPY --from=build /out/stellar-daemon /usr/local/bin/stellar-daemon
EXPOSE 8080 2022
ENTRYPOINT ["/usr/local/bin/stellar-daemon"]

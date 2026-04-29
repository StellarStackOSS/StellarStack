.PHONY: build run test tidy

BIN := bin/stellar-daemon

build:
	go build -o $(BIN) ./cmd/stellar-daemon

run:
	go run ./cmd/stellar-daemon

test:
	go test ./...

tidy:
	go mod tidy

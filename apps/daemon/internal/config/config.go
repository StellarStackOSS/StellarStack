// Package config loads and validates the daemon's persisted runtime
// configuration written by `stellar-daemon configure`.
package config

import (
	"fmt"
	"os"
)

// Version is the build version embedded into release binaries via -ldflags.
// During development it stays at the dev sentinel below.
var Version = "0.0.0-dev"

// ListenConfig describes how the daemon's HTTP/WS endpoint is exposed.
type ListenConfig struct {
	Host string
	Port int
}

// Config is the top-level daemon configuration. Loaded from
// /etc/stellar-daemon/config.yaml by default; override with STELLAR_CONFIG.
type Config struct {
	NodeID         string
	WorkerEndpoint string
	SigningKey     []byte
	Listen         ListenConfig
	SFTPListen     ListenConfig
	DataDir        string
}

// Load reads and validates the daemon configuration. Returns a sensible
// development default if the config file is absent so `runServe` can boot
// even before a node has been paired.
func Load() (*Config, error) {
	path := os.Getenv("STELLAR_CONFIG")
	if path == "" {
		path = "/etc/stellar-daemon/config.yaml"
	}
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return defaultDevConfig(), nil
	} else if err != nil {
		return nil, fmt.Errorf("stat %s: %w", path, err)
	}
	// TODO: parse YAML once the on-disk schema stabilises.
	return defaultDevConfig(), nil
}

func defaultDevConfig() *Config {
	return &Config{
		NodeID:         "dev-node",
		WorkerEndpoint: "ws://localhost:3000/daemon",
		Listen:         ListenConfig{Host: "0.0.0.0", Port: 8080},
		SFTPListen:     ListenConfig{Host: "0.0.0.0", Port: 2022},
		DataDir:        "/var/lib/stellar",
	}
}

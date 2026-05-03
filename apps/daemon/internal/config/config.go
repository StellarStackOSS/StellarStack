// Package config loads and persists the daemon's runtime configuration.
//
// `Load` reads /etc/stellar-daemon/config.yaml (or whatever STELLAR_CONFIG
// points to) and returns the parsed shape. `Save` is the inverse — used by
// `stellar-daemon configure` to persist the values returned by the API's
// pairing-claim endpoint.
package config

import (
	"fmt"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

// Version is the build version embedded into release binaries via -ldflags.
// During development it stays at the dev sentinel below.
var Version = "0.0.0-dev"

// ListenConfig describes how the daemon's HTTP/WS endpoint is exposed.
type ListenConfig struct {
	Host string `yaml:"host"`
	Port int    `yaml:"port"`
}

// Config is the top-level daemon configuration. Persisted as YAML at
// `Path()` (see DefaultPath / STELLAR_CONFIG env override).
type Config struct {
	NodeID        string       `yaml:"nodeId"`
	NodeName      string       `yaml:"nodeName,omitempty"`
	APIURL        string       `yaml:"apiUrl"`
	WebsocketURL  string       `yaml:"websocketUrl"`
	SigningKeyHex string       `yaml:"signingKeyHex"`
	Listen        ListenConfig `yaml:"listen"`
	SFTPListen    ListenConfig `yaml:"sftpListen"`
	DataDir       string       `yaml:"dataDir"`
	DockerSocket  string       `yaml:"dockerSocket,omitempty"`
}

// ResolvedDockerSocket returns the Docker socket path to use. If DockerSocket
// is set in config that wins; otherwise it probes Colima's socket before
// falling back to /var/run/docker.sock.
func (c *Config) ResolvedDockerSocket() string {
	if c.DockerSocket != "" {
		return c.DockerSocket
	}
	home, _ := os.UserHomeDir()
	colima := filepath.Join(home, ".colima", "default", "docker.sock")
	if _, err := os.Stat(colima); err == nil {
		return colima
	}
	return "/var/run/docker.sock"
}

// DefaultPath returns the canonical config path. /etc/stellar-daemon/config.yaml
// in production; ~/.stellar/daemon.yaml when running unprivileged for dev.
func DefaultPath() string {
	if env := os.Getenv("STELLAR_CONFIG"); env != "" {
		return env
	}
	if os.Getuid() == 0 {
		return "/etc/stellar-daemon/config.yaml"
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "config.yaml"
	}
	return filepath.Join(home, ".stellar", "daemon.yaml")
}

// Load reads and parses the daemon configuration. Returns a sensible
// development default if the config file is absent so `runServe` can boot
// even before a node has been paired (mostly useful for `version` and the
// "you forgot to configure" error path).
func Load() (*Config, error) {
	path := DefaultPath()
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			cfg := defaultDevConfig()
			cfg.SigningKeyHex = ""
			return cfg, nil
		}
		return nil, fmt.Errorf("read %s: %w", path, err)
	}
	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("parse %s: %w", path, err)
	}
	if cfg.Listen.Port == 0 {
		cfg.Listen = defaultDevConfig().Listen
	}
	if cfg.SFTPListen.Port == 0 {
		cfg.SFTPListen = defaultDevConfig().SFTPListen
	}
	if cfg.DataDir == "" {
		cfg.DataDir = defaultDevConfig().DataDir
	}
	return &cfg, nil
}

// Save writes the config to disk at `DefaultPath()`. Permissions are 0600
// because the file holds the per-node signing key.
func Save(cfg *Config) error {
	path := DefaultPath()
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return fmt.Errorf("mkdir %s: %w", filepath.Dir(path), err)
	}
	data, err := yaml.Marshal(cfg)
	if err != nil {
		return fmt.Errorf("marshal: %w", err)
	}
	if err := os.WriteFile(path, data, 0o600); err != nil {
		return fmt.Errorf("write %s: %w", path, err)
	}
	return nil
}

func defaultDevConfig() *Config {
	dataDir := "/var/lib/stellar"
	if os.Getuid() != 0 {
		if env := os.Getenv("STELLAR_DATA_DIR"); env != "" {
			dataDir = env
		} else if home, err := os.UserHomeDir(); err == nil {
			dataDir = filepath.Join(home, ".stellar", "data")
		}
	}
	return &Config{
		NodeID:        "",
		APIURL:        "http://localhost:3000",
		WebsocketURL:  "ws://localhost:3000/daemon/ws",
		SigningKeyHex: "",
		Listen:        ListenConfig{Host: "0.0.0.0", Port: 8080},
		SFTPListen:    ListenConfig{Host: "0.0.0.0", Port: 2022},
		DataDir:       dataDir,
	}
}

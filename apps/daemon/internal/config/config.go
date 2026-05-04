// Package config loads daemon configuration from disk. The daemon needs
// only a handful of fields to operate: its own node id, the per-node HMAC
// signing key (shared with the API at pair time), the API base URL it
// posts status callbacks to, the listen ports, and the data directory.
package config

import (
	"errors"
	"fmt"
	"os"

	"github.com/pelletier/go-toml/v2"
)

// Version is the daemon build version reported in the hello frame and
// status callbacks. Overridden at link time in production builds.
var Version = "dev"

// Config is the parsed runtime configuration. Field names are TOML-cased.
type Config struct {
	NodeID        string `toml:"node_id"`
	SigningKeyHex string `toml:"signing_key"`
	APIBaseURL    string `toml:"api_base_url"`
	HTTPListen    string `toml:"http_listen"`
	SFTPListen    string `toml:"sftp_listen"`
	SFTPHostKey   string `toml:"sftp_host_key"`
	DataDir       string `toml:"data_dir"`
	DockerSocket  string `toml:"docker_socket"`
	HistoryLines  int    `toml:"history_lines"`
}

// Load reads the TOML at `path` and validates the required fields. The
// config has no defaults file because the daemon cannot run useful work
// without a node id + signing key — operators must run
// `stellar-daemon configure <token>` first.
func Load(path string) (*Config, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", path, err)
	}
	var c Config
	if err := toml.Unmarshal(raw, &c); err != nil {
		return nil, fmt.Errorf("parse %s: %w", path, err)
	}
	if c.NodeID == "" {
		return nil, errors.New("config: node_id is required (run `stellar-daemon configure <token>`)")
	}
	if c.SigningKeyHex == "" {
		return nil, errors.New("config: signing_key is required (run `stellar-daemon configure <token>`)")
	}
	if c.APIBaseURL == "" {
		return nil, errors.New("config: api_base_url is required")
	}
	if c.HTTPListen == "" {
		c.HTTPListen = ":8081"
	}
	if c.SFTPListen == "" {
		c.SFTPListen = ":2022"
	}
	if c.SFTPHostKey == "" {
		c.SFTPHostKey = "/etc/stellar-daemon/sftp_host_key"
	}
	if c.DataDir == "" {
		c.DataDir = "/var/lib/stellarstack"
	}
	if c.DockerSocket == "" {
		c.DockerSocket = "/var/run/docker.sock"
	}
	if c.HistoryLines <= 0 {
		c.HistoryLines = 150
	}
	return &c, nil
}

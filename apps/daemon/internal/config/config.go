// Package config loads daemon configuration from disk. The daemon needs
// only a handful of fields to operate: its own node id, the per-node HMAC
// signing key (shared with the API at pair time), the API base URL it
// posts status callbacks to, the listen ports, and the data directory.
package config

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/pelletier/go-toml/v2"
)

// detectDockerSocket returns the first plausible Docker socket path: the
// $DOCKER_HOST unix:// override, then the standard /var/run path, then
// common per-user locations used by Docker Desktop, Colima, and OrbStack.
func detectDockerSocket() string {
	if v := os.Getenv("DOCKER_HOST"); strings.HasPrefix(v, "unix://") {
		return strings.TrimPrefix(v, "unix://")
	}
	candidates := []string{"/var/run/docker.sock"}
	if home, err := os.UserHomeDir(); err == nil {
		candidates = append(candidates,
			filepath.Join(home, ".docker/run/docker.sock"),
			filepath.Join(home, ".colima/default/docker.sock"),
			filepath.Join(home, ".orbstack/run/docker.sock"),
		)
	}
	for _, p := range candidates {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	return "/var/run/docker.sock"
}

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
	// Pick user-writable defaults when the config lives in $HOME, system
	// paths otherwise. Avoids permission errors during local dev.
	cfgDir := filepath.Dir(path)
	home, _ := os.UserHomeDir()
	userScoped := home != "" && strings.HasPrefix(cfgDir, home)
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
		if userScoped {
			c.SFTPHostKey = filepath.Join(cfgDir, "sftp_host_key")
		} else {
			c.SFTPHostKey = "/etc/stellar-daemon/sftp_host_key"
		}
	}
	if c.DataDir == "" {
		if userScoped {
			c.DataDir = filepath.Join(cfgDir, "data")
		} else {
			c.DataDir = "/var/lib/stellarstack"
		}
	}
	if c.DockerSocket == "" {
		c.DockerSocket = detectDockerSocket()
	}
	if c.HistoryLines <= 0 {
		c.HistoryLines = 150
	}
	return &c, nil
}

// Command stellar-daemon is the per-node Docker control daemon. It
// serves the browser-facing per-server WebSocket plus the API-facing
// remote control HTTP routes, and pushes container-state callbacks to
// the API when local state changes.
package main

import (
	"bytes"
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/stellarstack/daemon/internal/backup"
	"github.com/stellarstack/daemon/internal/config"
	"github.com/stellarstack/daemon/internal/docker"
	"github.com/stellarstack/daemon/internal/files"
	stellarjwt "github.com/stellarstack/daemon/internal/jwt"
	"github.com/stellarstack/daemon/internal/panel"
	"github.com/stellarstack/daemon/internal/router"
	"github.com/stellarstack/daemon/internal/server"
	"github.com/stellarstack/daemon/internal/sftp"
)

func main() {
	if len(os.Args) > 1 && os.Args[1] == "configure" {
		if err := runConfigure(os.Args[2:]); err != nil {
			fmt.Fprintln(os.Stderr, "configure:", err)
			os.Exit(1)
		}
		return
	}

	cfgPath := flag.String("config", defaultConfigPath(), "path to config.toml")
	flag.Parse()

	cfg, err := config.Load(*cfgPath)
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	dc := docker.New(cfg.DockerSocket)
	verifier, err := stellarjwt.New(cfg.SigningKeyHex)
	if err != nil {
		log.Fatalf("jwt verifier: %v", err)
	}
	panelClient, err := panel.New(cfg.APIBaseURL, cfg.NodeID, cfg.SigningKeyHex)
	if err != nil {
		log.Fatalf("panel client: %v", err)
	}
	// Tell the API the node is alive. Best-effort on boot; the ticker
	// below keeps it fresh so the admin nodes page reflects reality.
	go func() {
		hbCtx, hbCancel := context.WithTimeout(context.Background(), 5*time.Second)
		_ = panelClient.Heartbeat(hbCtx)
		hbCancel()
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			c, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			_ = panelClient.Heartbeat(c)
			cancel()
		}
	}()

	mgr := server.NewManager(dc, panelClient, cfg.HistoryLines)
	fm := files.New(cfg.DataDir)
	bm := backup.New(cfg.DataDir)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	mgr.Reconcile(ctx)

	r := router.New(cfg, verifier, mgr, fm, bm)
	srv := &http.Server{
		Addr:              cfg.HTTPListen,
		Handler:           r.Handler(),
		ReadHeaderTimeout: 15 * time.Second,
	}

	go func() {
		log.Printf("daemon: listening on %s", cfg.HTTPListen)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()

	sftpServer, err := sftp.New(struct {
		Listen      string
		HostKeyPath string
		Verifier    *stellarjwt.Verifier
		DataDir     string
		NodeID      string
	}{
		Listen:      cfg.SFTPListen,
		HostKeyPath: cfg.SFTPHostKey,
		Verifier:    verifier,
		DataDir:     cfg.DataDir,
		NodeID:      cfg.NodeID,
	})
	if err != nil {
		log.Printf("sftp: skipped (%v)", err)
	} else {
		go func() {
			if err := sftpServer.ListenAndServe(); err != nil {
				log.Printf("sftp: listener exited: %v", err)
			}
		}()
	}

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, os.Interrupt, syscall.SIGTERM)
	<-sig
	log.Println("daemon: shutting down")
	shutdownCtx, cancelShutdown := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancelShutdown()
	_ = srv.Shutdown(shutdownCtx)
}

// defaultConfigPath returns ~/.stellar-daemon/config.toml on dev hosts
// and /etc/stellar-daemon/config.toml on production. The env override
// (`STELLAR_DAEMON_CONFIG`) wins over both.
func defaultConfigPath() string {
	if v := os.Getenv("STELLAR_DAEMON_CONFIG"); v != "" {
		return v
	}
	if home, err := os.UserHomeDir(); err == nil {
		candidate := filepath.Join(home, ".stellar-daemon", "config.toml")
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}
	}
	return "/etc/stellar-daemon/config.toml"
}

// runConfigure exchanges a one-time pairing token for the per-node
// signing key and writes a fresh config.toml to disk.
//
// Usage: stellar-daemon configure <api-base-url> <pairing-token> [--out PATH]
//
// The pairing token format is `<nodeId>.<random>`; the daemon POSTs it
// to `<api>/api/nodes/pair/exchange`, receives `{nodeId, signingKey}`,
// and writes a config.toml the next `stellar-daemon` invocation can boot
// from. Existing config files are preserved unless --force is passed.
func runConfigure(args []string) error {
	if len(args) < 2 {
		return fmt.Errorf("usage: stellar-daemon configure <api-base-url> <pairing-token> [--out PATH] [--force]")
	}
	apiBase := strings.TrimRight(args[0], "/")
	token := args[1]
	outPath := defaultConfigPath()
	force := false
	for i := 2; i < len(args); i++ {
		switch args[i] {
		case "--out":
			if i+1 >= len(args) {
				return fmt.Errorf("--out requires a value")
			}
			outPath = args[i+1]
			i++
		case "--force":
			force = true
		default:
			return fmt.Errorf("unknown flag %q", args[i])
		}
	}
	if !force {
		if _, err := os.Stat(outPath); err == nil {
			return fmt.Errorf("%s exists; pass --force to overwrite", outPath)
		}
	}

	body, err := json.Marshal(map[string]string{"token": token})
	if err != nil {
		return err
	}
	req, err := http.NewRequest(http.MethodPost, apiBase+"/api/nodes/pair/exchange", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := (&http.Client{Timeout: 30 * time.Second}).Do(req)
	if err != nil {
		return fmt.Errorf("contact api: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return fmt.Errorf("pair exchange %s: %s", resp.Status, string(raw))
	}
	var out struct {
		NodeID     string `json:"nodeId"`
		SigningKey string `json:"signingKey"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return err
	}

	contents := fmt.Sprintf(`# Generated by stellar-daemon configure
node_id = %q
signing_key = %q
api_base_url = %q
http_listen = ":8081"
data_dir = "/var/lib/stellarstack"
docker_socket = "/var/run/docker.sock"
history_lines = 150
`, out.NodeID, out.SigningKey, apiBase)

	if err := os.MkdirAll(filepath.Dir(outPath), 0o755); err != nil {
		return fmt.Errorf("mkdir %s: %w", filepath.Dir(outPath), err)
	}
	if err := os.WriteFile(outPath, []byte(contents), 0o600); err != nil {
		return fmt.Errorf("write %s: %w", outPath, err)
	}
	fmt.Printf("configured node %s, wrote %s\n", out.NodeID, outPath)
	return nil
}

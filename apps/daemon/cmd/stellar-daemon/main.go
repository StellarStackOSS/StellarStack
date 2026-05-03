// Command stellar-daemon is the per-node Docker control daemon. It
// serves the browser-facing per-server WebSocket plus the API-facing
// remote control HTTP routes, and pushes container-state callbacks to
// the API when local state changes.
package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/stellarstack/daemon/internal/config"
	"github.com/stellarstack/daemon/internal/docker"
	stellarjwt "github.com/stellarstack/daemon/internal/jwt"
	"github.com/stellarstack/daemon/internal/panel"
	"github.com/stellarstack/daemon/internal/router"
	"github.com/stellarstack/daemon/internal/server"
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
	mgr := server.NewManager(dc, panelClient, cfg.HistoryLines)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	mgr.Reconcile(ctx)

	r := router.New(cfg, verifier, mgr)
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

// runConfigure is a placeholder for the pairing flow. Operators run
// `stellar-daemon configure <pairing-token>` to fetch the per-node
// signing key from the API. For now this just prints a usage hint; the
// pairing UX will be ported in a follow-up commit.
func runConfigure(args []string) error {
	if len(args) != 1 {
		return fmt.Errorf("usage: stellar-daemon configure <pairing-token>")
	}
	return fmt.Errorf("configure flow not yet implemented in the rebuild — write %s manually for now",
		defaultConfigPath())
}

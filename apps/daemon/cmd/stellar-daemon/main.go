// Command stellar-daemon is the per-node agent that owns the Docker socket,
// SFTP server, file API, lifecycle probes, and live console/stats streams
// for one StellarStack node. It dials home to the worker over a persistent
// WebSocket and authenticates inbound user requests via short-lived JWTs
// signed by the API and verified locally against a per-node key established
// at pairing time.
package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"github.com/stellarstack/daemon/internal/config"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintf(os.Stderr, "stellar-daemon: %v\n", err)
		os.Exit(1)
	}
}

func run() error {
	if len(os.Args) >= 2 {
		switch os.Args[1] {
		case "configure":
			return runConfigure(os.Args[2:])
		case "version":
			fmt.Println(config.Version)
			return nil
		}
	}
	return runServe()
}

func runServe() error {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("load config: %w", err)
	}

	fmt.Printf("stellar-daemon %s starting on %s:%d\n", config.Version, cfg.Listen.Host, cfg.Listen.Port)

	<-ctx.Done()
	return nil
}

// runConfigure claims a one-time pairing token from the panel, fetches the
// node's runtime configuration, generates a signing keypair, and writes the
// resulting daemon config to disk. Network logic is filled in alongside the
// pairing milestone.
func runConfigure(args []string) error {
	if len(args) < 1 {
		return fmt.Errorf("usage: stellar-daemon configure <token>")
	}
	token := args[0]
	fmt.Printf("configure: would claim token %q (not implemented)\n", token)
	return nil
}

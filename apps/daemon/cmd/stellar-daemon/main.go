// Command stellar-daemon is the per-node agent that owns the Docker socket,
// SFTP server, file API, lifecycle probes, and live console/stats streams
// for one StellarStack node. It dials home to the worker over a persistent
// WebSocket and authenticates inbound user requests via short-lived JWTs
// signed by the API and verified locally against a per-node key established
// at pairing time.
package main

import (
	"context"
	"flag"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/stellarstack/daemon/internal/config"
	"github.com/stellarstack/daemon/internal/console"
	stellarjwt "github.com/stellarstack/daemon/internal/jwt"
	"github.com/stellarstack/daemon/internal/pairing"
	"github.com/stellarstack/daemon/internal/ws"
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
		case "help", "-h", "--help":
			printHelp()
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

	fmt.Printf("stellar-daemon %s starting (node=%s)\n", config.Version, displayNode(cfg))

	client := ws.New(cfg)
	httpServer := startConsoleServer(cfg, client)

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = httpServer.Shutdown(shutdownCtx)
	}()

	return client.Run(ctx)
}

func startConsoleServer(cfg *config.Config, client *ws.Client) *http.Server {
	verifier := stellarjwt.New(cfg.SigningKeyHex, cfg.NodeID)
	consoleServer := console.New(verifier, client.Handler())
	mux := http.NewServeMux()
	consoleServer.Mount(mux)
	addr := fmt.Sprintf("%s:%d", cfg.Listen.Host, cfg.Listen.Port)
	server := &http.Server{
		Addr:              addr,
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
	}
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		fmt.Fprintf(os.Stderr, "stellar-daemon: console listen %s: %v\n", addr, err)
		return server
	}
	go func() {
		_ = server.Serve(listener)
	}()
	fmt.Printf("stellar-daemon console listening on %s\n", addr)
	return server
}

func runConfigure(args []string) error {
	flagSet := flag.NewFlagSet("configure", flag.ExitOnError)
	apiURL := flagSet.String("api", "", "API base URL (overrides existing config)")
	flagSet.Usage = func() {
		fmt.Fprintln(flagSet.Output(), "Usage: stellar-daemon configure [--api <url>] <token>")
	}
	if err := flagSet.Parse(args); err != nil {
		return err
	}
	if flagSet.NArg() != 1 {
		flagSet.Usage()
		return fmt.Errorf("expected exactly one positional <token>")
	}
	return pairing.Claim(flagSet.Arg(0), *apiURL)
}

func displayNode(cfg *config.Config) string {
	if cfg.NodeID == "" {
		return "(unpaired)"
	}
	if cfg.NodeName != "" {
		return fmt.Sprintf("%s/%s", cfg.NodeName, cfg.NodeID)
	}
	return cfg.NodeID
}

func printHelp() {
	fmt.Print(`stellar-daemon — StellarStack per-node agent

Usage:
  stellar-daemon                      run the daemon (default)
  stellar-daemon configure <token>    claim a pairing token issued by the panel
  stellar-daemon version              print the build version
  stellar-daemon help                 show this message

Environment:
  STELLAR_CONFIG    override the on-disk config path
`)
}

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
	"github.com/stellarstack/daemon/internal/files"
	stellarjwt "github.com/stellarstack/daemon/internal/jwt"
	"github.com/stellarstack/daemon/internal/pairing"
	"github.com/stellarstack/daemon/internal/sftp"
	"github.com/stellarstack/daemon/internal/transfer"
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
	verifier := stellarjwt.New(cfg.SigningKeyHex, cfg.NodeID)
	fileManager := files.New(cfg.DataDir)

	httpServer := startHTTPServer(cfg, client, verifier, fileManager)
	sftpServer, err := sftp.New(cfg, verifier, fileManager)
	if err != nil {
		fmt.Fprintf(os.Stderr, "stellar-daemon: sftp init: %v\n", err)
	} else {
		go func() {
			if err := sftpServer.Listen(); err != nil {
				fmt.Fprintf(os.Stderr, "stellar-daemon: sftp listen: %v\n", err)
			}
		}()
	}

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = httpServer.Shutdown(shutdownCtx)
	}()

	return client.Run(ctx)
}

// gateForScopes returns a files.AuthGate that validates the JWT in
// `?token=` carries every required scope and is bound to the path's
// server id (the gate is invoked per-request so each call walks the
// claims afresh).
func gateForScopes(verifier *stellarjwt.Verifier) files.AuthGate {
	return func(r *http.Request, requiredScopes ...string) (bool, int) {
		token := r.URL.Query().Get("token")
		if token == "" {
			return false, http.StatusUnauthorized
		}
		claims, err := verifier.Verify(token)
		if err != nil {
			return false, http.StatusUnauthorized
		}
		serverID := extractServerID(r.URL.Path)
		if serverID == "" || claims.Server != serverID {
			return false, http.StatusUnauthorized
		}
		for _, scope := range requiredScopes {
			if !claims.HasScope(scope) {
				return false, http.StatusForbidden
			}
		}
		return true, http.StatusOK
	}
}

func extractServerID(urlPath string) string {
	const prefix = "/servers/"
	if len(urlPath) <= len(prefix) {
		return ""
	}
	rest := urlPath[len(prefix):]
	for i := 0; i < len(rest); i++ {
		if rest[i] == '/' {
			return rest[:i]
		}
	}
	return rest
}

func startHTTPServer(
	cfg *config.Config,
	client *ws.Client,
	verifier *stellarjwt.Verifier,
	fileManager *files.Manager,
) *http.Server {
	consoleServer := console.New(verifier, client.Handler())
	transferHandler := transfer.NewHandler(client.Handler().Transfer, fileManager)
	mux := http.NewServeMux()
	gate := gateForScopes(verifier)
	mux.Handle("/internal/transfer/", transferHandler)
	mux.HandleFunc("/servers/", func(w http.ResponseWriter, r *http.Request) {
		if consoleServer.HandleConsole(w, r) {
			return
		}
		if fileManager.HandleFiles(w, r, gate) {
			return
		}
		http.NotFound(w, r)
	})

	addr := fmt.Sprintf("%s:%d", cfg.Listen.Host, cfg.Listen.Port)
	server := &http.Server{
		Addr:              addr,
		Handler:           withCORS(mux),
		ReadHeaderTimeout: 10 * time.Second,
	}
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		fmt.Fprintf(os.Stderr, "stellar-daemon: http listen %s: %v\n", addr, err)
		return server
	}
	go func() {
		_ = server.Serve(listener)
	}()
	fmt.Printf("stellar-daemon http listening on %s\n", addr)
	return server
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Vary", "Origin")
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type,Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
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

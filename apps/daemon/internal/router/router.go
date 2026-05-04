// Package router serves the daemon's HTTP surface: the browser-facing
// per-server WebSocket and the API-facing remote control endpoints.
//
// We deliberately use the stdlib mux + a small dispatcher rather than a
// router library; the route table is small and predictable, and we avoid
// a transitive dep we'd otherwise have to keep on top of.
package router

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/stellarstack/daemon/internal/backup"
	"github.com/stellarstack/daemon/internal/config"
	"github.com/stellarstack/daemon/internal/files"
	"github.com/stellarstack/daemon/internal/jwt"
	"github.com/stellarstack/daemon/internal/server"
)

// Router wires the WS and remote handlers against the shared dependencies.
type Router struct {
	cfg      *config.Config
	verifier *jwt.Verifier
	manager  *server.Manager
	files    *files.Manager
	backups  *backup.Manager
}

func New(cfg *config.Config, v *jwt.Verifier, m *server.Manager, f *files.Manager, b *backup.Manager) *Router {
	return &Router{cfg: cfg, verifier: v, manager: m, files: f, backups: b}
}

// Handler returns the http.Handler the daemon should serve.
func (r *Router) Handler() http.Handler {
	mux := http.NewServeMux()
	// Browser-facing WS. Path: /api/servers/:uuid/ws
	mux.HandleFunc("/api/servers/", r.routeServerSubpath)
	// Remote (API → daemon) control. Path: /api/remote/...
	mux.HandleFunc("/api/remote/", r.routeRemote)
	// Health probe.
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"ok":true}`))
	})
	return mux
}

// routeServerSubpath dispatches /api/servers/{uuid}/(ws|...). Only ws is
// implemented for now; the others return 404 placeholders.
func (r *Router) routeServerSubpath(w http.ResponseWriter, req *http.Request) {
	parts := strings.Split(strings.Trim(req.URL.Path, "/"), "/")
	if len(parts) < 4 || parts[0] != "api" || parts[1] != "servers" {
		http.NotFound(w, req)
		return
	}
	uuid := parts[2]
	switch {
	case len(parts) == 4 && parts[3] == "ws":
		r.handleWS(w, req, uuid)
	case len(parts) >= 4 && parts[3] == "files":
		r.handleFiles(w, req, uuid)
	case len(parts) >= 4 && parts[3] == "backups":
		r.handleBackups(w, req, uuid)
	case len(parts) == 5 && parts[3] == "transfer" && parts[4] == "ingest":
		r.handleTransferIngest(w, req, uuid)
	case len(parts) == 5 && parts[3] == "transfer" && parts[4] == "push":
		r.handleTransferPush(w, req, uuid)
	case len(parts) == 4 && parts[3] == "power":
		r.handlePower(w, req, uuid)
	case len(parts) == 4 && parts[3] == "command":
		r.handleCommand(w, req, uuid)
	case len(parts) >= 4 && parts[3] == "install":
		// API-initiated install. Verified with daemon HMAC, not browser
		// JWT, so route through the remote auth middleware.
		if !r.verifyDaemonHMAC(req) {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		r.handleInstall(w, req, uuid)
	default:
		http.NotFound(w, req)
	}
}

// routeRemote dispatches /api/remote/* — currently unused (daemon-side
// pull operations would live here; no callbacks are inbound from the
// API today since the API is the one initiating install/file/backup).
func (r *Router) routeRemote(w http.ResponseWriter, req *http.Request) {
	http.NotFound(w, req)
}

// verifyDaemonHMAC checks that the request was signed by the API using
// the same per-node key the daemon holds. Mirrors the panel client's
// signing scheme: HMAC-SHA256 over `<nodeId>|<unix-seconds>`.
func (r *Router) verifyDaemonHMAC(req *http.Request) bool {
	nodeID := req.Header.Get("X-Stellar-Node-Id")
	ts := req.Header.Get("X-Stellar-Timestamp")
	auth := req.Header.Get("Authorization")
	if nodeID == "" || ts == "" || !strings.HasPrefix(auth, "Bearer ") {
		return false
	}
	if nodeID != r.cfg.NodeID {
		return false
	}
	tsInt, err := strconv.ParseInt(ts, 10, 64)
	if err != nil {
		return false
	}
	if abs(time.Now().Unix()-tsInt) > 60 {
		return false
	}
	key, err := hex.DecodeString(r.cfg.SigningKeyHex)
	if err != nil {
		return false
	}
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(nodeID + "|" + ts))
	expected := mac.Sum(nil)
	provided, err := hex.DecodeString(strings.TrimPrefix(auth, "Bearer "))
	if err != nil {
		return false
	}
	return hmac.Equal(expected, provided)
}

func abs(x int64) int64 {
	if x < 0 {
		return -x
	}
	return x
}

// errBadRequest is a small helper used by the install handler.
var errBadRequest = errors.New("bad request")

// timeoutCtx returns ctx with a relative deadline, preserving cancel
// chain. Unused today; kept for the install handler's eventual use.
func timeoutCtx(parent context.Context, d time.Duration) (context.Context, context.CancelFunc) {
	return context.WithTimeout(parent, d)
}

func writeJSONError(w http.ResponseWriter, status int, code string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = fmt.Fprintf(w, `{"error":{"code":%q}}`, code)
}

func init() { _ = log.Println }

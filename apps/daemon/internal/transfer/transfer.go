// Package transfer handles the daemon side of server-to-server moves.
// The target daemon registers expected inbound transfers (by one-time token)
// and exposes an HTTP PUT endpoint that the source daemon streams an archive
// into. The source daemon's push is triggered by a "server.push_transfer"
// WS message from the worker.
package transfer

import (
	"context"
	"crypto/subtle"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/stellarstack/daemon/internal/files"
)

// Registry stores expected inbound transfers so the HTTP endpoint can
// validate the one-time token and map it to a server ID.
type Registry struct {
	mu      sync.Mutex
	pending map[string]pendingTransfer
}

type pendingTransfer struct {
	serverID  string
	expiresAt time.Time
}

// NewRegistry returns an empty Registry.
func NewRegistry() *Registry {
	return &Registry{pending: map[string]pendingTransfer{}}
}

// Register stores an expected inbound transfer. Tokens expire after 1 hour.
func (r *Registry) Register(token, serverID string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.pending[token] = pendingTransfer{
		serverID:  serverID,
		expiresAt: time.Now().Add(time.Hour),
	}
}

// Consume validates and removes the token in one step. Returns the server ID
// and true on success; returns empty string and false if invalid/expired.
func (r *Registry) Consume(token string) (string, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	pt, ok := r.pending[token]
	if !ok || time.Now().After(pt.expiresAt) {
		delete(r.pending, token)
		return "", false
	}
	delete(r.pending, token)
	return pt.serverID, true
}

// Handler is the HTTP handler for PUT /internal/transfer/:token.
// It receives a streaming tar.gz from the source daemon, wipes the server's
// bind-mount, and extracts the archive over it.
type Handler struct {
	registry *Registry
	manager  *files.Manager
}

// NewHandler returns an HTTP handler bound to the given registry and file manager.
func NewHandler(registry *Registry, manager *files.Manager) *Handler {
	return &Handler{registry: registry, manager: manager}
}

// ServeHTTP handles PUT /internal/transfer/:token
func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract token from path: /internal/transfer/<token>
	const prefix = "/internal/transfer/"
	if !strings.HasPrefix(r.URL.Path, prefix) {
		http.NotFound(w, r)
		return
	}
	token := r.URL.Path[len(prefix):]
	if token == "" || strings.Contains(token, "/") {
		http.Error(w, "invalid token", http.StatusBadRequest)
		return
	}

	// Constant-time token check via Consume (which also prevents replay)
	serverID, ok := h.registry.Consume(token)
	if !ok {
		// Consume with a dummy to keep timing consistent
		_ = subtle.ConstantTimeCompare([]byte(token), []byte("dummy"))
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	if err := h.manager.RestoreBackupFromReader(serverID, r.Body); err != nil {
		log.Printf("transfer: restore from stream: %v", err)
		http.Error(w, "restore failed", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// PushToTarget archives the server's bind-mount and streams it to the target
// daemon's receive endpoint. Called by the WS handler when it receives a
// "server.push_transfer" message.
func PushToTarget(
	ctx context.Context,
	manager *files.Manager,
	serverID string,
	targetURL string,
	token string,
) error {
	// Write archive to a temp file so we can stream it with a known size.
	tmpFile, err := os.CreateTemp("", "stellar-transfer-*.tar.gz")
	if err != nil {
		return fmt.Errorf("create temp: %w", err)
	}
	tmpPath := tmpFile.Name()
	tmpFile.Close()
	defer os.Remove(tmpPath)

	// Reuse the backup writer to produce the archive.
	if _, err := manager.ArchiveServerTo(serverID, tmpPath); err != nil {
		return fmt.Errorf("archive: %w", err)
	}

	f, err := os.Open(tmpPath)
	if err != nil {
		return fmt.Errorf("open archive: %w", err)
	}
	defer f.Close()

	stat, err := f.Stat()
	if err != nil {
		return fmt.Errorf("stat archive: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPut, targetURL, f)
	if err != nil {
		return fmt.Errorf("build request: %w", err)
	}
	req.ContentLength = stat.Size()
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/octet-stream")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("push: %w", err)
	}
	defer resp.Body.Close()
	io.Copy(io.Discard, resp.Body)

	if resp.StatusCode != http.StatusNoContent {
		return fmt.Errorf("target returned %d", resp.StatusCode)
	}
	return nil
}

// ArchiveDir is the subdirectory under dataDir used for temporary transfer archives.
const ArchiveDir = "transfers"

// TransferArchivePath returns the on-disk path for a transfer archive.
func TransferArchivePath(dataDir, serverID string) string {
	return filepath.Join(dataDir, ArchiveDir, serverID+".tar.gz")
}

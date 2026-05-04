package router

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/stellarstack/daemon/internal/files"
	"github.com/stellarstack/daemon/internal/jwt"
)

// FilesEnabled wires the file manager handlers into the router. Called
// from main; keeps router.go stable and hides the file-specific deps.
type filesRouter struct {
	verifier *jwt.Verifier
	files    *files.Manager
	nodeID   string
}

// HandleFiles is the entry point for /api/servers/:uuid/files/* requests.
// Authentication is via JWT in the `?token=` query param. Scope check:
//   - GET / list-dir / stat: files.read
//   - PUT / mkdir / move:    files.write
//   - DELETE:                files.delete
func (r *Router) handleFiles(w http.ResponseWriter, req *http.Request, serverID string) {
	if r.files == nil {
		http.Error(w, "files disabled", http.StatusServiceUnavailable)
		return
	}
	token := req.URL.Query().Get("token")
	if token == "" {
		http.Error(w, "missing token", http.StatusUnauthorized)
		return
	}
	claims, err := r.verifier.Verify(token)
	if err != nil {
		http.Error(w, "invalid token", http.StatusUnauthorized)
		return
	}
	if claims.Server != serverID || claims.Node != r.cfg.NodeID {
		http.Error(w, "token scope mismatch", http.StatusUnauthorized)
		return
	}

	op := req.URL.Query().Get("op")
	relPath := req.URL.Query().Get("path")
	switch op {
	case "list":
		if !claims.HasScope("files.read") {
			http.Error(w, "missing files.read", http.StatusForbidden)
			return
		}
		entries, err := r.files.List(serverID, relPath)
		if err != nil {
			writeJSONError(w, http.StatusBadRequest, "files.list_failed")
			return
		}
		writeJSON(w, map[string]any{"entries": entries})
	case "read":
		if !claims.HasScope("files.read") {
			http.Error(w, "missing files.read", http.StatusForbidden)
			return
		}
		rd, size, err := r.files.Read(serverID, relPath)
		if err != nil {
			if errors.Is(err, files.ErrTooLarge) {
				writeJSONError(w, http.StatusRequestEntityTooLarge, "files.too_large")
				return
			}
			writeJSONError(w, http.StatusBadRequest, "files.read_failed")
			return
		}
		defer rd.Close()
		w.Header().Set("Content-Type", "application/octet-stream")
		w.Header().Set("Content-Length", itoa(size))
		_, _ = io.Copy(w, rd)
	case "write":
		if !claims.HasScope("files.write") {
			http.Error(w, "missing files.write", http.StatusForbidden)
			return
		}
		body := http.MaxBytesReader(w, req.Body, 50*1024*1024)
		defer body.Close()
		if err := r.files.Write(serverID, relPath, body); err != nil {
			writeJSONError(w, http.StatusBadRequest, "files.write_failed")
			return
		}
		writeJSON(w, map[string]any{"ok": true})
	case "mkdir":
		if !claims.HasScope("files.write") {
			http.Error(w, "missing files.write", http.StatusForbidden)
			return
		}
		if err := r.files.Mkdir(serverID, relPath); err != nil {
			writeJSONError(w, http.StatusBadRequest, "files.mkdir_failed")
			return
		}
		writeJSON(w, map[string]any{"ok": true})
	case "delete":
		if !claims.HasScope("files.delete") {
			http.Error(w, "missing files.delete", http.StatusForbidden)
			return
		}
		if err := r.files.Delete(serverID, relPath); err != nil {
			writeJSONError(w, http.StatusBadRequest, "files.delete_failed")
			return
		}
		writeJSON(w, map[string]any{"ok": true})
	case "move":
		if !claims.HasScope("files.write") {
			http.Error(w, "missing files.write", http.StatusForbidden)
			return
		}
		var body struct{ From, To string }
		if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
			writeJSONError(w, http.StatusBadRequest, "files.bad_request")
			return
		}
		if err := r.files.Move(serverID, body.From, body.To); err != nil {
			writeJSONError(w, http.StatusBadRequest, "files.move_failed")
			return
		}
		writeJSON(w, map[string]any{"ok": true})
	case "stat":
		if !claims.HasScope("files.read") {
			http.Error(w, "missing files.read", http.StatusForbidden)
			return
		}
		entry, err := r.files.Stat(serverID, relPath)
		if err != nil {
			writeJSONError(w, http.StatusBadRequest, "files.stat_failed")
			return
		}
		writeJSON(w, map[string]any{"entry": entry})
	default:
		http.NotFound(w, req)
	}
	_ = filesRouter{} // keep type referenced
}

// writeJSON marshals + writes with the standard headers.
func writeJSON(w http.ResponseWriter, body any) {
	w.Header().Set("Content-Type", "application/json")
	buf, _ := json.Marshal(body)
	_, _ = w.Write(buf)
}

func itoa(n int64) string {
	if n == 0 {
		return "0"
	}
	negative := n < 0
	if negative {
		n = -n
	}
	var b [20]byte
	i := len(b)
	for n > 0 {
		i--
		b[i] = byte('0' + n%10)
		n /= 10
	}
	if negative {
		i--
		b[i] = '-'
	}
	return string(b[i:])
}

// withSlashCount is a tiny helper; the routeServerSubpath dispatcher
// matches `/api/servers/:uuid/files` so any deeper segments aren't
// significant — the operation is encoded in the `?op=` query.
var _ = strings.Count

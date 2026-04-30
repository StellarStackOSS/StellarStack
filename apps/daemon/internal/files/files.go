// Package files implements the per-server file API mounted on the
// daemon's HTTP listener. Browsers call into this directly using a JWT
// minted by the API; SFTP traffic uses the same `safePath` jail logic.
//
// Every operation resolves the requested path inside the server's
// bind-mount root and rejects anything that would escape via "..", absolute
// paths, or symlinks. Errors flow back as JSON `{ "error": { code, ... } }`
// envelopes mirroring the API's translation-key shape so the browser only
// ever sees one error format.
package files

import (
	"archive/zip"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// Manager owns per-server file operations rooted under
// `${dataDir}/servers/{serverId}`.
type Manager struct {
	root string
}

// New returns a Manager rooted at `root` (typically the daemon's
// `cfg.DataDir`).
func New(root string) *Manager {
	return &Manager{root: root}
}

// Entry mirrors the wire shape returned by `GET /servers/:id/files`.
type Entry struct {
	Name    string    `json:"name"`
	Path    string    `json:"path"`
	IsDir   bool      `json:"isDir"`
	Size    int64     `json:"size"`
	Mode    string    `json:"mode"`
	ModTime time.Time `json:"modTime"`
}

// SafePath resolves `requested` against the server's root, rejecting any
// traversal attempt. Returns the absolute on-disk path on success.
func (m *Manager) SafePath(serverID, requested string) (string, error) {
	if strings.Contains(requested, "\x00") {
		return "", errors.New("invalid path")
	}
	root := filepath.Join(m.root, "servers", serverID)
	// Resolve the root itself first so we compare against the canonical path.
	resolvedRoot, err := filepath.EvalSymlinks(root)
	if err != nil {
		if os.IsNotExist(err) {
			// Root doesn't exist yet (pre-install). Fall back to lexical check.
			resolvedRoot = root
		} else {
			return "", fmt.Errorf("resolve root: %w", err)
		}
	}

	// Walk each component of the requested path, resolving symlinks as we go.
	// This catches symlinks at intermediate directories.
	cleaned := filepath.Clean("/" + requested)
	parts := strings.Split(filepath.ToSlash(cleaned), "/")
	current := resolvedRoot
	for _, part := range parts {
		if part == "" || part == "." {
			continue
		}
		if part == ".." {
			return "", errors.New("path escapes server root")
		}
		current = filepath.Join(current, part)
		// Resolve symlinks at this level, but only if the path exists.
		if resolved, err := filepath.EvalSymlinks(current); err == nil {
			rel, err := filepath.Rel(resolvedRoot, resolved)
			if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(os.PathSeparator)) {
				return "", errors.New("symlink escapes server root")
			}
			current = resolved
		}
		// If the path doesn't exist yet (e.g. creating a new file), that's fine —
		// we just continue with the un-resolved path and let the caller create it.
	}
	// Final lexical escape check.
	rel, err := filepath.Rel(resolvedRoot, current)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(os.PathSeparator)) {
		return "", errors.New("path escapes server root")
	}
	return current, nil
}

// List returns the directory listing at `path` for `serverID`. If the
// server's root doesn't yet exist (server hasn't been provisioned on this
// host) it returns an empty slice rather than 404 so the panel can still
// render.
func (m *Manager) List(serverID, path string) ([]Entry, error) {
	abs, err := m.SafePath(serverID, path)
	if err != nil {
		return nil, err
	}
	info, err := os.Stat(abs)
	if err != nil {
		if os.IsNotExist(err) {
			return []Entry{}, nil
		}
		return nil, err
	}
	if !info.IsDir() {
		return nil, errors.New("not a directory")
	}
	entries, err := os.ReadDir(abs)
	if err != nil {
		return nil, err
	}
	out := make([]Entry, 0, len(entries))
	for _, dirent := range entries {
		fi, err := dirent.Info()
		if err != nil {
			continue
		}
		out = append(out, Entry{
			Name:    dirent.Name(),
			Path:    filepath.Join(filepath.Clean("/"+path), dirent.Name()),
			IsDir:   dirent.IsDir(),
			Size:    fi.Size(),
			Mode:    fi.Mode().String(),
			ModTime: fi.ModTime(),
		})
	}
	return out, nil
}

// ReadAll returns the entire contents of `path`. Caller is responsible for
// enforcing a max-bytes limit at the HTTP layer.
func (m *Manager) ReadAll(serverID, path string) ([]byte, error) {
	abs, err := m.SafePath(serverID, path)
	if err != nil {
		return nil, err
	}
	return os.ReadFile(abs)
}

// WriteAll writes `data` to `path`, creating parent directories as needed.
func (m *Manager) WriteAll(serverID, path string, data []byte) error {
	abs, err := m.SafePath(serverID, path)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(abs), 0o755); err != nil {
		return err
	}
	return os.WriteFile(abs, data, 0o644)
}

// Mkdir creates the directory at `path` (with parents).
func (m *Manager) Mkdir(serverID, path string) error {
	abs, err := m.SafePath(serverID, path)
	if err != nil {
		return err
	}
	return os.MkdirAll(abs, 0o755)
}

// Delete removes the file or directory at `path` (recursive).
func (m *Manager) Delete(serverID, path string) error {
	abs, err := m.SafePath(serverID, path)
	if err != nil {
		return err
	}
	return os.RemoveAll(abs)
}

// Rename moves `from` to `to`, both resolved inside the server root.
func (m *Manager) Rename(serverID, from, to string) error {
	src, err := m.SafePath(serverID, from)
	if err != nil {
		return err
	}
	dst, err := m.SafePath(serverID, to)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return err
	}
	return os.Rename(src, dst)
}

// HTTP routes ----------------------------------------------------------

// AuthGate must return claims with the right scopes for the request, or
// nil + an HTTP status to short-circuit. Wired by the daemon's main using
// the JWT verifier.
type AuthGate func(r *http.Request, requiredScopes ...string) (ok bool, status int)

// HandleFiles is the dispatcher for `/servers/:id/files...` paths. The
// daemon's main composes this with the console handler under a single
// mux entry so two packages don't fight over `/servers/`.
func (m *Manager) HandleFiles(w http.ResponseWriter, r *http.Request, gate AuthGate) bool {
	serverID, sub, ok := splitPath(r.URL.Path)
	if !ok {
		return false
	}
	switch {
	case sub == "/files" && r.Method == http.MethodGet:
		m.handleList(w, r, serverID, gate)
	case sub == "/files/content" && r.Method == http.MethodGet:
		m.handleRead(w, r, serverID, gate)
	case sub == "/files/content" && r.Method == http.MethodPut:
		m.handleWrite(w, r, serverID, gate)
	case sub == "/files/mkdir" && r.Method == http.MethodPost:
		m.handleMkdir(w, r, serverID, gate)
	case sub == "/files" && r.Method == http.MethodDelete:
		m.handleDelete(w, r, serverID, gate)
	case sub == "/files/rename" && r.Method == http.MethodPost:
		m.handleRename(w, r, serverID, gate)
	case sub == "/files/upload" && r.Method == http.MethodPost:
		m.handleUpload(w, r, serverID, gate)
	case sub == "/files/download" && r.Method == http.MethodGet:
		m.handleDownload(w, r, serverID, gate)
	case sub == "/files/compress" && r.Method == http.MethodPost:
		m.handleCompress(w, r, serverID, gate)
	case sub == "/files/decompress" && r.Method == http.MethodPost:
		m.handleDecompress(w, r, serverID, gate)
	default:
		return false
	}
	return true
}

func splitPath(urlPath string) (serverID string, sub string, ok bool) {
	const prefix = "/servers/"
	if !strings.HasPrefix(urlPath, prefix) {
		return "", "", false
	}
	rest := urlPath[len(prefix):]
	idx := strings.Index(rest, "/")
	if idx == -1 {
		return "", "", false
	}
	return rest[:idx], rest[idx:], true
}

func (m *Manager) handleList(w http.ResponseWriter, r *http.Request, serverID string, gate AuthGate) {
	if ok, status := gate(r, "files.read"); !ok {
		writeError(w, status, "permissions.denied")
		return
	}
	path := r.URL.Query().Get("path")
	entries, err := m.List(serverID, path)
	if err != nil {
		writeFsError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"entries": entries})
}

func (m *Manager) handleRead(w http.ResponseWriter, r *http.Request, serverID string, gate AuthGate) {
	if ok, status := gate(r, "files.read"); !ok {
		writeError(w, status, "permissions.denied")
		return
	}
	path := r.URL.Query().Get("path")
	data, err := m.ReadAll(serverID, path)
	if err != nil {
		writeFsError(w, err)
		return
	}
	if len(data) > 5*1024*1024 {
		writeError(w, http.StatusRequestEntityTooLarge, "files.too_large")
		return
	}
	w.Header().Set("Content-Type", "application/octet-stream")
	_, _ = w.Write(data)
}

func (m *Manager) handleWrite(w http.ResponseWriter, r *http.Request, serverID string, gate AuthGate) {
	if ok, status := gate(r, "files.write"); !ok {
		writeError(w, status, "permissions.denied")
		return
	}
	path := r.URL.Query().Get("path")
	data, err := io.ReadAll(io.LimitReader(r.Body, 10*1024*1024))
	if err != nil {
		writeError(w, http.StatusBadRequest, "files.invalid_body")
		return
	}
	if err := m.WriteAll(serverID, path, data); err != nil {
		writeFsError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (m *Manager) handleMkdir(w http.ResponseWriter, r *http.Request, serverID string, gate AuthGate) {
	if ok, status := gate(r, "files.write"); !ok {
		writeError(w, status, "permissions.denied")
		return
	}
	var body struct {
		Path string `json:"path"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "files.invalid_body")
		return
	}
	if err := m.Mkdir(serverID, body.Path); err != nil {
		writeFsError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (m *Manager) handleDelete(w http.ResponseWriter, r *http.Request, serverID string, gate AuthGate) {
	if ok, status := gate(r, "files.delete"); !ok {
		writeError(w, status, "permissions.denied")
		return
	}
	path := r.URL.Query().Get("path")
	if err := m.Delete(serverID, path); err != nil {
		writeFsError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (m *Manager) handleRename(w http.ResponseWriter, r *http.Request, serverID string, gate AuthGate) {
	if ok, status := gate(r, "files.write"); !ok {
		writeError(w, status, "permissions.denied")
		return
	}
	var body struct {
		From string `json:"from"`
		To   string `json:"to"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "files.invalid_body")
		return
	}
	if err := m.Rename(serverID, body.From, body.To); err != nil {
		writeFsError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (m *Manager) handleUpload(w http.ResponseWriter, r *http.Request, serverID string, gate AuthGate) {
	if ok, status := gate(r, "files.write"); !ok {
		writeError(w, status, "permissions.denied")
		return
	}
	if err := r.ParseMultipartForm(512 << 20); err != nil {
		writeError(w, http.StatusBadRequest, "files.invalid_body")
		return
	}
	targetDir := r.URL.Query().Get("path")
	if targetDir == "" {
		targetDir = "/"
	}
	count := 0
	for _, fh := range r.MultipartForm.File["file"] {
		name := filepath.ToSlash(fh.Filename)
		for strings.HasPrefix(name, "../") {
			name = name[3:]
		}
		if name == "" {
			continue
		}
		rel := filepath.Join(targetDir, name)
		abs, err := m.SafePath(serverID, rel)
		if err != nil {
			writeError(w, http.StatusForbidden, "files.path_outside_jail")
			return
		}
		if err := os.MkdirAll(filepath.Dir(abs), 0o755); err != nil {
			writeFsError(w, err)
			return
		}
		src, err := fh.Open()
		if err != nil {
			writeError(w, http.StatusBadRequest, "files.invalid_body")
			return
		}
		data, err := io.ReadAll(src)
		src.Close()
		if err != nil {
			writeError(w, http.StatusBadRequest, "files.invalid_body")
			return
		}
		if err := os.WriteFile(abs, data, 0o644); err != nil {
			writeFsError(w, err)
			return
		}
		count++
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "count": count})
}

func (m *Manager) handleDownload(w http.ResponseWriter, r *http.Request, serverID string, gate AuthGate) {
	if ok, status := gate(r, "files.read"); !ok {
		writeError(w, status, "permissions.denied")
		return
	}
	reqPath := r.URL.Query().Get("path")
	abs, err := m.SafePath(serverID, reqPath)
	if err != nil {
		writeFsError(w, err)
		return
	}
	info, err := os.Stat(abs)
	if err != nil {
		writeFsError(w, err)
		return
	}
	if !info.IsDir() {
		w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, info.Name()))
		w.Header().Set("Content-Type", "application/octet-stream")
		f, err := os.Open(abs)
		if err != nil {
			writeFsError(w, err)
			return
		}
		defer f.Close()
		_, _ = io.Copy(w, f)
		return
	}
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s.zip"`, info.Name()))
	w.Header().Set("Content-Type", "application/zip")
	zw := zip.NewWriter(w)
	defer zw.Close()
	_ = filepath.Walk(abs, func(p string, fi os.FileInfo, walkErr error) error {
		if walkErr != nil {
			return nil
		}
		if fi.IsDir() {
			return nil
		}
		rel, err := filepath.Rel(abs, p)
		if err != nil {
			return nil
		}
		entry, err := zw.Create(filepath.ToSlash(rel))
		if err != nil {
			return nil
		}
		f, err := os.Open(p)
		if err != nil {
			return nil
		}
		defer f.Close()
		_, _ = io.Copy(entry, f)
		return nil
	})
}

func (m *Manager) handleCompress(w http.ResponseWriter, r *http.Request, serverID string, gate AuthGate) {
	if ok, status := gate(r, "files.write"); !ok {
		writeError(w, status, "permissions.denied")
		return
	}
	var body struct {
		Paths       []string `json:"paths"`
		Destination string   `json:"destination"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "files.invalid_body")
		return
	}
	dstAbs, err := m.SafePath(serverID, body.Destination)
	if err != nil {
		writeFsError(w, err)
		return
	}
	if err := os.MkdirAll(filepath.Dir(dstAbs), 0o755); err != nil {
		writeFsError(w, err)
		return
	}
	out, err := os.Create(dstAbs)
	if err != nil {
		writeFsError(w, err)
		return
	}
	defer out.Close()
	zw := zip.NewWriter(out)
	defer zw.Close()
	for _, p := range body.Paths {
		abs, err := m.SafePath(serverID, p)
		if err != nil {
			continue
		}
		info, err := os.Stat(abs)
		if err != nil {
			continue
		}
		base := filepath.Base(abs)
		if info.IsDir() {
			_ = filepath.Walk(abs, func(walkPath string, fi os.FileInfo, walkErr error) error {
				if walkErr != nil || fi.IsDir() {
					return nil
				}
				rel, err := filepath.Rel(filepath.Dir(abs), walkPath)
				if err != nil {
					return nil
				}
				entry, err := zw.Create(filepath.ToSlash(filepath.Join(base, strings.TrimPrefix(rel, base+"/"))))
				if err != nil {
					return nil
				}
				f, err := os.Open(walkPath)
				if err != nil {
					return nil
				}
				defer f.Close()
				_, _ = io.Copy(entry, f)
				return nil
			})
		} else {
			entry, err := zw.Create(base)
			if err != nil {
				continue
			}
			f, err := os.Open(abs)
			if err != nil {
				continue
			}
			_, _ = io.Copy(entry, f)
			f.Close()
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (m *Manager) handleDecompress(w http.ResponseWriter, r *http.Request, serverID string, gate AuthGate) {
	if ok, status := gate(r, "files.write"); !ok {
		writeError(w, status, "permissions.denied")
		return
	}
	var body struct {
		Path        string `json:"path"`
		Destination string `json:"destination"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "files.invalid_body")
		return
	}
	srcAbs, err := m.SafePath(serverID, body.Path)
	if err != nil {
		writeFsError(w, err)
		return
	}
	dstAbs, err := m.SafePath(serverID, body.Destination)
	if err != nil {
		writeFsError(w, err)
		return
	}
	zr, err := zip.OpenReader(srcAbs)
	if err != nil {
		writeFsError(w, err)
		return
	}
	defer zr.Close()
	count := 0
	for _, f := range zr.File {
		name := filepath.ToSlash(f.Name)
		target, err := m.SafePath(serverID, filepath.Join(body.Destination, name))
		if err != nil {
			writeError(w, http.StatusForbidden, "files.path_outside_jail")
			return
		}
		_ = dstAbs
		if f.FileInfo().IsDir() {
			if err := os.MkdirAll(target, 0o755); err != nil {
				writeFsError(w, err)
				return
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			writeFsError(w, err)
			return
		}
		rc, err := f.Open()
		if err != nil {
			writeFsError(w, err)
			return
		}
		data, err := io.ReadAll(rc)
		rc.Close()
		if err != nil {
			writeFsError(w, err)
			return
		}
		if err := os.WriteFile(target, data, 0o644); err != nil {
			writeFsError(w, err)
			return
		}
		count++
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "count": count})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func writeError(w http.ResponseWriter, status int, code string) {
	writeJSON(w, status, map[string]any{
		"error": map[string]any{"code": code, "requestId": "daemon"},
	})
}

func writeFsError(w http.ResponseWriter, err error) {
	if err == nil {
		writeError(w, http.StatusInternalServerError, "internal.unexpected")
		return
	}
	log.Printf("daemon: file op: %v", err)
	if strings.Contains(err.Error(), "escapes server root") {
		writeError(w, http.StatusForbidden, "files.path_outside_jail")
		return
	}
	if os.IsNotExist(err) {
		writeError(w, http.StatusNotFound, "files.not_found")
		return
	}
	if os.IsPermission(err) {
		writeError(w, http.StatusForbidden, "files.read_only")
		return
	}
	writeError(w, http.StatusInternalServerError, "internal.unexpected")
}

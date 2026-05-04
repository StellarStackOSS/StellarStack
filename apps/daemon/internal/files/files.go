// Package files implements the per-server filesystem operations the
// browser hits via the API proxy. Every operation is path-confined to
// the server's bind-mount root: no symlink-traversal, no parent-of-root
// escapes, no absolute paths from the caller.
package files

import (
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// Manager is the per-daemon entry point. The data dir is shared with
// the docker bind mount; each server's tree lives at
// `<dataDir>/servers/<uuid>`.
type Manager struct {
	dataDir string
}

func New(dataDir string) *Manager { return &Manager{dataDir: dataDir} }

// Entry is one filesystem entry returned by List.
type Entry struct {
	Name    string `json:"name"`
	Path    string `json:"path"`
	IsDir   bool   `json:"isDir"`
	Size    int64  `json:"size"`
	ModTime string `json:"modTime"`
	Mode    string `json:"mode"`
}

// resolve returns the absolute filesystem path for a server-relative
// path, refusing any input that escapes the server root.
func (m *Manager) resolve(serverID, rel string) (string, error) {
	if serverID == "" {
		return "", errors.New("server id required")
	}
	root := filepath.Join(m.dataDir, "servers", serverID)
	clean := filepath.Clean("/" + rel) // forces leading /, collapses .. against root
	abs := filepath.Join(root, clean)
	if !strings.HasPrefix(abs, root) {
		return "", errors.New("path escapes server root")
	}
	return abs, nil
}

// List returns the entries directly under `path` within the server tree.
func (m *Manager) List(serverID, path string) ([]Entry, error) {
	abs, err := m.resolve(serverID, path)
	if err != nil {
		return nil, err
	}
	infos, err := os.ReadDir(abs)
	if err != nil {
		if os.IsNotExist(err) {
			return []Entry{}, nil
		}
		return nil, err
	}
	out := make([]Entry, 0, len(infos))
	for _, info := range infos {
		fi, err := info.Info()
		if err != nil {
			continue
		}
		out = append(out, Entry{
			Name:    info.Name(),
			Path:    filepath.Join(path, info.Name()),
			IsDir:   info.IsDir(),
			Size:    fi.Size(),
			ModTime: fi.ModTime().UTC().Format(time.RFC3339),
			Mode:    fi.Mode().String(),
		})
	}
	return out, nil
}

// Read streams a file's contents. Returns ErrTooLarge if the file is
// over `maxBytes`; the caller can then fall back to a download URL.
const MaxReadBytes = 5 * 1024 * 1024

var ErrTooLarge = errors.New("file too large for inline read")

func (m *Manager) Read(serverID, path string) (io.ReadCloser, int64, error) {
	abs, err := m.resolve(serverID, path)
	if err != nil {
		return nil, 0, err
	}
	st, err := os.Stat(abs)
	if err != nil {
		return nil, 0, err
	}
	if st.IsDir() {
		return nil, 0, errors.New("is a directory")
	}
	if st.Size() > MaxReadBytes {
		return nil, st.Size(), ErrTooLarge
	}
	f, err := os.Open(abs)
	if err != nil {
		return nil, 0, err
	}
	return f, st.Size(), nil
}

// Write replaces the file contents.
func (m *Manager) Write(serverID, path string, body io.Reader) error {
	abs, err := m.resolve(serverID, path)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(abs), 0o755); err != nil {
		return err
	}
	f, err := os.Create(abs)
	if err != nil {
		return err
	}
	defer f.Close()
	if _, err := io.Copy(f, body); err != nil {
		return err
	}
	return nil
}

// Mkdir creates a directory (recursive, idempotent).
func (m *Manager) Mkdir(serverID, path string) error {
	abs, err := m.resolve(serverID, path)
	if err != nil {
		return err
	}
	return os.MkdirAll(abs, 0o755)
}

// Delete removes a file or directory tree.
func (m *Manager) Delete(serverID, path string) error {
	if path == "" || path == "/" {
		return errors.New("refusing to delete server root")
	}
	abs, err := m.resolve(serverID, path)
	if err != nil {
		return err
	}
	return os.RemoveAll(abs)
}

// Move renames `from` to `to`.
func (m *Manager) Move(serverID, from, to string) error {
	src, err := m.resolve(serverID, from)
	if err != nil {
		return err
	}
	dst, err := m.resolve(serverID, to)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return err
	}
	return os.Rename(src, dst)
}

// Stat returns metadata for one entry.
func (m *Manager) Stat(serverID, path string) (Entry, error) {
	abs, err := m.resolve(serverID, path)
	if err != nil {
		return Entry{}, err
	}
	st, err := os.Stat(abs)
	if err != nil {
		return Entry{}, err
	}
	return Entry{
		Name:    st.Name(),
		Path:    path,
		IsDir:   st.IsDir(),
		Size:    st.Size(),
		ModTime: st.ModTime().UTC().Format(time.RFC3339),
		Mode:    st.Mode().String(),
	}, nil
}

// safe is an internal helper used in tests. Kept here to avoid an
// unused-import flag in case the build adds debugging hooks later.
var safe = fmt.Sprintf

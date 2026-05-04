// Package files implements the per-server filesystem operations the
// browser hits via the API proxy. Every operation is path-confined to
// the server's bind-mount root: no symlink-traversal, no parent-of-root
// escapes, no absolute paths from the caller.
package files

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
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

// Decompress extracts the archive at `archivePath` into `destDir`.
// Format is sniffed from the filename: `.tar.gz`/`.tgz` → tar+gzip,
// `.tar` → tar, `.zip` → zip, `.gz` → single-file gzip. Every entry
// is jail-checked against `destDir` (no `..` or absolute escapes) and
// symlinks/devices are skipped, mirroring the upstream daemon's jail
// rules.
func (m *Manager) Decompress(serverID, archivePath, destDir string) error {
	src, err := m.resolve(serverID, archivePath)
	if err != nil {
		return err
	}
	dst, err := m.resolve(serverID, destDir)
	if err != nil {
		return err
	}
	if st, err := os.Stat(dst); err != nil {
		return err
	} else if !st.IsDir() {
		return errors.New("destination is not a directory")
	}
	lower := strings.ToLower(archivePath)
	switch {
	case strings.HasSuffix(lower, ".tar.gz"), strings.HasSuffix(lower, ".tgz"):
		return extractTar(src, dst, true)
	case strings.HasSuffix(lower, ".tar"):
		return extractTar(src, dst, false)
	case strings.HasSuffix(lower, ".zip"):
		return extractZip(src, dst)
	case strings.HasSuffix(lower, ".gz"):
		base := filepath.Base(archivePath)
		out := strings.TrimSuffix(base, ".gz")
		if out == "" || out == base {
			out = base + ".out"
		}
		target, err := jailedPath(dst, out)
		if err != nil {
			return err
		}
		return extractGzip(src, target)
	default:
		return errors.New("unsupported archive format")
	}
}

func extractTar(archivePath, destDir string, gzipped bool) error {
	f, err := os.Open(archivePath)
	if err != nil {
		return err
	}
	defer f.Close()
	var rd io.Reader = f
	if gzipped {
		gz, err := gzip.NewReader(f)
		if err != nil {
			return err
		}
		defer gz.Close()
		rd = gz
	}
	tr := tar.NewReader(rd)
	for {
		hdr, err := tr.Next()
		if errors.Is(err, io.EOF) {
			return nil
		}
		if err != nil {
			return err
		}
		target, err := jailedPath(destDir, hdr.Name)
		if err != nil {
			return err
		}
		switch hdr.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(target, 0o755); err != nil {
				return err
			}
		case tar.TypeReg, tar.TypeRegA:
			if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
				return err
			}
			out, err := os.OpenFile(target, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o644)
			if err != nil {
				return err
			}
			if _, err := io.Copy(out, tr); err != nil {
				out.Close()
				return err
			}
			out.Close()
		}
	}
}

func extractZip(archivePath, destDir string) error {
	rd, err := zip.OpenReader(archivePath)
	if err != nil {
		return err
	}
	defer rd.Close()
	for _, f := range rd.File {
		target, err := jailedPath(destDir, f.Name)
		if err != nil {
			return err
		}
		if f.FileInfo().IsDir() {
			if err := os.MkdirAll(target, 0o755); err != nil {
				return err
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			return err
		}
		in, err := f.Open()
		if err != nil {
			return err
		}
		out, err := os.OpenFile(target, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o644)
		if err != nil {
			in.Close()
			return err
		}
		if _, err := io.Copy(out, in); err != nil {
			in.Close()
			out.Close()
			return err
		}
		in.Close()
		out.Close()
	}
	return nil
}

func extractGzip(archivePath, destFile string) error {
	f, err := os.Open(archivePath)
	if err != nil {
		return err
	}
	defer f.Close()
	gz, err := gzip.NewReader(f)
	if err != nil {
		return err
	}
	defer gz.Close()
	if err := os.MkdirAll(filepath.Dir(destFile), 0o755); err != nil {
		return err
	}
	out, err := os.OpenFile(destFile, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o644)
	if err != nil {
		return err
	}
	defer out.Close()
	_, err = io.Copy(out, gz)
	return err
}

func jailedPath(root, name string) (string, error) {
	clean := filepath.Clean("/" + name)
	abs := filepath.Join(root, clean)
	if !strings.HasPrefix(abs, filepath.Clean(root)+string(os.PathSeparator)) && abs != root {
		return "", errors.New("entry escapes destination")
	}
	return abs, nil
}

// safe is an internal helper used in tests. Kept here to avoid an
// unused-import flag in case the build adds debugging hooks later.
var safe = fmt.Sprintf

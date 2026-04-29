// Backup/restore lives next to the file API so it shares the
// safe-path resolver and the bind-mount layout. Archives are tar+gzip
// (deflate is portable across every base image; zstd would shave bytes
// but adds a dependency).
package files

import (
	"archive/tar"
	"compress/gzip"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// BackupResult is what the daemon reports back to the worker after an
// archive completes.
type BackupResult struct {
	Path   string
	Bytes  int64
	SHA256 string
}

// CreateBackup tars + gzips the server's bind-mount root into
// `${root}/backups/{serverId}/{name}.tar.gz`. Returns the on-disk path,
// total byte size, and the sha256 of the archive bytes.
func (m *Manager) CreateBackup(serverID, name string) (BackupResult, error) {
	srcRoot := filepath.Join(m.root, "servers", serverID)
	if resolved, err := filepath.EvalSymlinks(srcRoot); err == nil {
		srcRoot = resolved
	}
	if _, err := os.Stat(srcRoot); err != nil {
		return BackupResult{}, fmt.Errorf("server root: %w", err)
	}

	dstDir := filepath.Join(m.root, "backups", serverID)
	if err := os.MkdirAll(dstDir, 0o755); err != nil {
		return BackupResult{}, err
	}
	dstPath := filepath.Join(dstDir, sanitizeName(name)+".tar.gz")

	out, err := os.OpenFile(dstPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o644)
	if err != nil {
		return BackupResult{}, err
	}
	defer out.Close()

	hasher := sha256.New()
	counter := &countingWriter{}
	multi := io.MultiWriter(out, hasher, counter)
	gz := gzip.NewWriter(multi)
	tw := tar.NewWriter(gz)

	walkErr := filepath.Walk(srcRoot, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(srcRoot, path)
		if err != nil {
			return err
		}
		if rel == "." {
			return nil
		}
		header, err := tar.FileInfoHeader(info, "")
		if err != nil {
			return err
		}
		header.Name = rel
		if err := tw.WriteHeader(header); err != nil {
			return err
		}
		if info.Mode().IsRegular() {
			f, err := os.Open(path)
			if err != nil {
				return err
			}
			_, copyErr := io.Copy(tw, f)
			closeErr := f.Close()
			if copyErr != nil {
				return copyErr
			}
			if closeErr != nil {
				return closeErr
			}
		}
		return nil
	})
	if walkErr != nil {
		return BackupResult{}, walkErr
	}
	if err := tw.Close(); err != nil {
		return BackupResult{}, err
	}
	if err := gz.Close(); err != nil {
		return BackupResult{}, err
	}

	return BackupResult{
		Path:   dstPath,
		Bytes:  counter.bytes,
		SHA256: hex.EncodeToString(hasher.Sum(nil)),
	}, nil
}

// RestoreBackup wipes the server's bind-mount root and unpacks the named
// archive over it. Caller must stop the container first.
func (m *Manager) RestoreBackup(serverID, name string) error {
	srcPath := filepath.Join(
		m.root, "backups", serverID, sanitizeName(name)+".tar.gz",
	)
	if _, err := os.Stat(srcPath); err != nil {
		return fmt.Errorf("archive: %w", err)
	}
	dstRoot := filepath.Join(m.root, "servers", serverID)
	if err := os.RemoveAll(dstRoot); err != nil {
		return err
	}
	if err := os.MkdirAll(dstRoot, 0o755); err != nil {
		return err
	}
	if resolved, err := filepath.EvalSymlinks(dstRoot); err == nil {
		dstRoot = resolved
	}

	in, err := os.Open(srcPath)
	if err != nil {
		return err
	}
	defer in.Close()
	gz, err := gzip.NewReader(in)
	if err != nil {
		return err
	}
	defer gz.Close()
	tr := tar.NewReader(gz)
	for {
		header, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
		if strings.Contains(header.Name, "..") {
			return fmt.Errorf("archive entry %q contains traversal", header.Name)
		}
		target := filepath.Join(dstRoot, header.Name)
		switch header.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(target, os.FileMode(header.Mode)); err != nil {
				return err
			}
		case tar.TypeReg:
			if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
				return err
			}
			f, err := os.OpenFile(target, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, os.FileMode(header.Mode))
			if err != nil {
				return err
			}
			_, copyErr := io.Copy(f, tr)
			closeErr := f.Close()
			if copyErr != nil {
				return copyErr
			}
			if closeErr != nil {
				return closeErr
			}
		default:
			// skip symlinks and other entry types — they're not produced
			// by CreateBackup, so anything unusual is hostile.
		}
	}
	return nil
}

// DeleteBackup removes the named archive file. Idempotent.
func (m *Manager) DeleteBackup(serverID, name string) error {
	path := filepath.Join(
		m.root, "backups", serverID, sanitizeName(name)+".tar.gz",
	)
	err := os.Remove(path)
	if os.IsNotExist(err) {
		return nil
	}
	return err
}

// BackupReader opens the archive for streaming, e.g. to upload to S3.
func (m *Manager) BackupReader(serverID, name string) (*os.File, error) {
	path := filepath.Join(
		m.root, "backups", serverID, sanitizeName(name)+".tar.gz",
	)
	return os.Open(path)
}

func sanitizeName(name string) string {
	out := strings.Map(func(r rune) rune {
		switch {
		case r >= 'a' && r <= 'z':
			return r
		case r >= 'A' && r <= 'Z':
			return r
		case r >= '0' && r <= '9':
			return r
		case r == '-' || r == '_' || r == '.':
			return r
		}
		return '_'
	}, name)
	if out == "" {
		out = "backup"
	}
	return out
}

type countingWriter struct {
	bytes int64
}

func (c *countingWriter) Write(p []byte) (int, error) {
	n := len(p)
	c.bytes += int64(n)
	return n, nil
}

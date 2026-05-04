// Package backup snapshots and restores per-server bind-mount trees.
// Local backups land in `<dataDir>/backups/<server>/<name>.tar.gz`. S3
// backups are post-uploaded by the API after the daemon hands back a
// download URL or streams the body — for v1 we keep it local-only and
// add S3 in a follow-up.
package backup

import (
	"archive/tar"
	"compress/gzip"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// Manager holds the daemon's backup configuration. The data dir is
// shared with the docker bind mount and the backup output path.
type Manager struct {
	dataDir string
}

func New(dataDir string) *Manager { return &Manager{dataDir: dataDir} }

// Result is what the daemon returns to the API after a successful
// create. Bytes is the on-disk size of the gzipped tarball.
type Result struct {
	Name   string `json:"name"`
	Bytes  int64  `json:"bytes"`
	SHA256 string `json:"sha256"`
}

// Create snapshots the server's bind-mount tree to a gzipped tarball.
// Returns the resulting size + sha256 so the API can persist them.
func (m *Manager) Create(serverID, name string) (Result, error) {
	if !validName(name) {
		return Result{}, errors.New("invalid backup name")
	}
	src := filepath.Join(m.dataDir, "servers", serverID)
	if _, err := os.Stat(src); err != nil {
		return Result{}, fmt.Errorf("server root: %w", err)
	}
	dstDir := filepath.Join(m.dataDir, "backups", serverID)
	if err := os.MkdirAll(dstDir, 0o755); err != nil {
		return Result{}, fmt.Errorf("mkdir backup dir: %w", err)
	}
	dst := filepath.Join(dstDir, name+".tar.gz")
	out, err := os.Create(dst)
	if err != nil {
		return Result{}, fmt.Errorf("create tarball: %w", err)
	}
	defer out.Close()

	hasher := sha256.New()
	mw := io.MultiWriter(out, hasher)
	gz := gzip.NewWriter(mw)
	tw := tar.NewWriter(gz)

	walkErr := filepath.Walk(src, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(src, path)
		if err != nil {
			return err
		}
		if rel == "." {
			return nil
		}
		hdr, err := tar.FileInfoHeader(info, "")
		if err != nil {
			return err
		}
		hdr.Name = rel
		if err := tw.WriteHeader(hdr); err != nil {
			return err
		}
		if !info.Mode().IsRegular() {
			return nil
		}
		f, err := os.Open(path)
		if err != nil {
			return err
		}
		defer f.Close()
		_, err = io.Copy(tw, f)
		return err
	})
	if walkErr != nil {
		_ = tw.Close()
		_ = gz.Close()
		os.Remove(dst)
		return Result{}, walkErr
	}
	if err := tw.Close(); err != nil {
		os.Remove(dst)
		return Result{}, err
	}
	if err := gz.Close(); err != nil {
		os.Remove(dst)
		return Result{}, err
	}
	if err := out.Sync(); err != nil {
		return Result{}, err
	}
	st, err := os.Stat(dst)
	if err != nil {
		return Result{}, err
	}
	return Result{
		Name:   name,
		Bytes:  st.Size(),
		SHA256: hex.EncodeToString(hasher.Sum(nil)),
	}, nil
}

// Restore extracts the named tarball back into the server's bind mount.
// Wipes the existing tree first; caller is expected to have stopped the
// container.
func (m *Manager) Restore(serverID, name string) error {
	if !validName(name) {
		return errors.New("invalid backup name")
	}
	src := filepath.Join(m.dataDir, "backups", serverID, name+".tar.gz")
	dst := filepath.Join(m.dataDir, "servers", serverID)
	in, err := os.Open(src)
	if err != nil {
		return fmt.Errorf("open backup: %w", err)
	}
	defer in.Close()
	gz, err := gzip.NewReader(in)
	if err != nil {
		return fmt.Errorf("gzip: %w", err)
	}
	defer gz.Close()
	if err := os.RemoveAll(dst); err != nil {
		return err
	}
	if err := os.MkdirAll(dst, 0o755); err != nil {
		return err
	}
	tr := tar.NewReader(gz)
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
		clean := filepath.Clean("/" + hdr.Name)
		target := filepath.Join(dst, clean)
		if !strings.HasPrefix(target, dst) {
			return errors.New("tar entry escapes server root")
		}
		switch hdr.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(target, os.FileMode(hdr.Mode)); err != nil {
				return err
			}
		case tar.TypeReg, tar.TypeRegA:
			if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
				return err
			}
			f, err := os.OpenFile(target, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, os.FileMode(hdr.Mode))
			if err != nil {
				return err
			}
			if _, err := io.Copy(f, tr); err != nil {
				f.Close()
				return err
			}
			f.Close()
		}
	}
	return nil
}

// Delete removes the named backup from disk.
func (m *Manager) Delete(serverID, name string) error {
	if !validName(name) {
		return errors.New("invalid backup name")
	}
	path := filepath.Join(m.dataDir, "backups", serverID, name+".tar.gz")
	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

// validName disallows any path components in a backup name. We'd never
// accept `..` but also never accept `/` so a single-flat-file scheme is
// enforced regardless.
func validName(name string) bool {
	if name == "" {
		return false
	}
	if strings.Contains(name, "/") || strings.Contains(name, "\\") || strings.Contains(name, "..") {
		return false
	}
	return true
}

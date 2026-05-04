package sftp

import (
	"errors"
	"io"
	"os"
	"path/filepath"
	"time"

	pkgsftp "github.com/pkg/sftp"
)

// chrootFS implements pkg/sftp's Handlers contract against a confined
// directory tree. Every supplied path is resolved through `resolve`
// before any os.* call so the SFTP client cannot escape `root` via
// `..` or absolute paths.
type chrootFS struct {
	root    string
	resolve func(string) (string, error)
}

func (f *chrootFS) Fileread(req *pkgsftp.Request) (io.ReaderAt, error) {
	abs, err := f.resolve(req.Filepath)
	if err != nil {
		return nil, err
	}
	return os.OpenFile(abs, os.O_RDONLY, 0o644)
}

func (f *chrootFS) Filewrite(req *pkgsftp.Request) (io.WriterAt, error) {
	abs, err := f.resolve(req.Filepath)
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(filepath.Dir(abs), 0o755); err != nil {
		return nil, err
	}
	return os.OpenFile(abs, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o644)
}

func (f *chrootFS) Filecmd(req *pkgsftp.Request) error {
	abs, err := f.resolve(req.Filepath)
	if err != nil {
		return err
	}
	switch req.Method {
	case "Setstat":
		// File attributes (chmod/chown) are intentionally a no-op: the
		// container runs as a fixed UID, so changing modes from outside
		// is rarely meaningful and gives a tidy default for clients.
		return nil
	case "Rename":
		target, err := f.resolve(req.Target)
		if err != nil {
			return err
		}
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			return err
		}
		return os.Rename(abs, target)
	case "Rmdir":
		return os.Remove(abs)
	case "Mkdir":
		return os.MkdirAll(abs, 0o755)
	case "Symlink":
		target, err := f.resolve(req.Target)
		if err != nil {
			return err
		}
		return os.Symlink(target, abs)
	case "Remove":
		return os.Remove(abs)
	}
	return errors.New("unsupported method: " + req.Method)
}

func (f *chrootFS) Filelist(req *pkgsftp.Request) (pkgsftp.ListerAt, error) {
	abs, err := f.resolve(req.Filepath)
	if err != nil {
		return nil, err
	}
	switch req.Method {
	case "List":
		entries, err := os.ReadDir(abs)
		if err != nil {
			return nil, err
		}
		infos := make([]os.FileInfo, 0, len(entries))
		for _, e := range entries {
			info, err := e.Info()
			if err != nil {
				continue
			}
			infos = append(infos, info)
		}
		return listerAt(infos), nil
	case "Stat":
		info, err := os.Stat(abs)
		if err != nil {
			return nil, err
		}
		return listerAt([]os.FileInfo{info}), nil
	case "Readlink":
		target, err := os.Readlink(abs)
		if err != nil {
			return nil, err
		}
		return listerAt([]os.FileInfo{readlinkInfo(target)}), nil
	}
	return nil, errors.New("unsupported list method: " + req.Method)
}

// listerAt is a tiny adapter so we can hand a slice of FileInfo to
// pkg/sftp without boilerplate.
type listerAt []os.FileInfo

func (l listerAt) ListAt(out []os.FileInfo, offset int64) (int, error) {
	if offset >= int64(len(l)) {
		return 0, io.EOF
	}
	n := copy(out, l[offset:])
	if n < len(out) {
		return n, io.EOF
	}
	return n, nil
}

// readlinkInfo wraps the link target as a FileInfo just so listerAt can
// surface it. The file mode is bogus; clients that care about the type
// re-Stat the link target themselves.
type readlinkInfo string

func (r readlinkInfo) Name() string      { return string(r) }
func (r readlinkInfo) Size() int64       { return int64(len(r)) }
func (r readlinkInfo) Mode() os.FileMode { return os.ModeSymlink | 0o777 }
func (r readlinkInfo) ModTime() time.Time { return time.Time{} }
func (r readlinkInfo) IsDir() bool       { return false }
func (r readlinkInfo) Sys() any          { return nil }

// Package sftp embeds an SFTP server (pkg/sftp over
// golang.org/x/crypto/ssh) that authenticates clients against JWTs minted
// by the API. Sessions are jailed to ${dataDir}/servers/{serverId}.
//
// Connection model: the client provides
//   username = "{userId}.{serverId}"
//   password = a JWT carrying the `sftp` scope and a matching server claim
// The host key is generated on first start and persisted next to the
// daemon config file so subsequent boots present a stable identity.
package sftp

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"os"
	"path/filepath"
	"strings"

	"github.com/pkg/sftp"
	"golang.org/x/crypto/ssh"

	"github.com/stellarstack/daemon/internal/config"
	"github.com/stellarstack/daemon/internal/files"
	stellarjwt "github.com/stellarstack/daemon/internal/jwt"
)

// Server hosts the SFTP listener for one daemon.
type Server struct {
	cfg      *config.Config
	verifier *stellarjwt.Verifier
	files    *files.Manager
	host     ssh.Signer
}

// New builds a Server. Loads or creates the host key on disk.
func New(cfg *config.Config, verifier *stellarjwt.Verifier, manager *files.Manager) (*Server, error) {
	host, err := loadOrCreateHostKey(cfg)
	if err != nil {
		return nil, err
	}
	return &Server{cfg: cfg, verifier: verifier, files: manager, host: host}, nil
}

// Listen starts accepting SFTP connections on the configured port. Blocks
// until the listener returns an error.
func (s *Server) Listen() error {
	addr := fmt.Sprintf("%s:%d", s.cfg.SFTPListen.Host, s.cfg.SFTPListen.Port)
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		return fmt.Errorf("sftp listen %s: %w", addr, err)
	}
	defer listener.Close()
	log.Printf("stellar-daemon sftp listening on %s", addr)

	cfg := &ssh.ServerConfig{
		PasswordCallback: s.passwordCallback,
		ServerVersion:    "SSH-2.0-StellarStack-SFTP",
	}
	cfg.AddHostKey(s.host)

	for {
		conn, err := listener.Accept()
		if err != nil {
			return err
		}
		go s.handle(conn, cfg)
	}
}

func (s *Server) passwordCallback(meta ssh.ConnMetadata, password []byte) (*ssh.Permissions, error) {
	user := meta.User()
	parts := strings.SplitN(user, ".", 2)
	if len(parts) != 2 {
		return nil, errors.New("username must be {userId}.{serverId}")
	}
	userID, serverID := parts[0], parts[1]

	claims, err := s.verifier.Verify(string(password))
	if err != nil {
		return nil, fmt.Errorf("invalid token: %w", err)
	}
	if claims.Sub != userID {
		return nil, errors.New("token user mismatch")
	}
	if claims.Server != serverID {
		return nil, errors.New("token server mismatch")
	}
	if !claims.HasScope("sftp") {
		return nil, errors.New("missing sftp scope")
	}
	return &ssh.Permissions{
		Extensions: map[string]string{
			"server-id": serverID,
			"user-id":   userID,
		},
	}, nil
}

func (s *Server) handle(conn net.Conn, cfg *ssh.ServerConfig) {
	defer conn.Close()
	sshConn, chans, reqs, err := ssh.NewServerConn(conn, cfg)
	if err != nil {
		log.Printf("sftp: handshake: %v", err)
		return
	}
	defer sshConn.Close()
	go ssh.DiscardRequests(reqs)

	serverID := sshConn.Permissions.Extensions["server-id"]
	root := filepath.Join(s.cfg.DataDir, "servers", serverID)
	if err := os.MkdirAll(root, 0o755); err != nil {
		log.Printf("sftp: mkdir root: %v", err)
		return
	}

	for newChan := range chans {
		if newChan.ChannelType() != "session" {
			_ = newChan.Reject(ssh.UnknownChannelType, "only session channels supported")
			continue
		}
		channel, requests, err := newChan.Accept()
		if err != nil {
			log.Printf("sftp: accept channel: %v", err)
			continue
		}
		go s.handleChannel(channel, requests, root)
	}
}

func (s *Server) handleChannel(channel ssh.Channel, requests <-chan *ssh.Request, root string) {
	defer channel.Close()
	for req := range requests {
		ok := false
		if req.Type == "subsystem" {
			subsystem := strings.TrimPrefix(string(req.Payload), "\x00\x00\x00\x04")
			if subsystem == "sftp" {
				ok = true
				go func() {
					handlers := newJailedHandlers(root)
					server := sftp.NewRequestServer(channel, handlers)
					if err := server.Serve(); err != nil && err != io.EOF {
						log.Printf("sftp: serve: %v", err)
					}
					_ = server.Close()
					_ = channel.Close()
				}()
			}
		}
		_ = req.Reply(ok, nil)
	}
}

// jailedHandlers wraps `sftp.Root` with explicit path validation so any
// "../" or absolute escape attempts return EACCES rather than touching
// the host filesystem outside the jail.
func newJailedHandlers(root string) sftp.Handlers {
	root = filepath.Clean(root)
	jailed := &jailFS{root: root}
	return sftp.Handlers{
		FileGet:  jailed,
		FilePut:  jailed,
		FileCmd:  jailed,
		FileList: jailed,
	}
}

type jailFS struct {
	root string
}

func (j *jailFS) jail(virtual string) (string, error) {
	cleaned := filepath.Clean("/" + virtual)
	candidate := filepath.Join(j.root, cleaned)
	rel, err := filepath.Rel(j.root, candidate)
	if err != nil {
		return "", err
	}
	if rel == ".." || strings.HasPrefix(rel, ".."+string(os.PathSeparator)) {
		return "", os.ErrPermission
	}
	return candidate, nil
}

func (j *jailFS) Fileread(req *sftp.Request) (io.ReaderAt, error) {
	abs, err := j.jail(req.Filepath)
	if err != nil {
		return nil, err
	}
	return os.Open(abs)
}

func (j *jailFS) Filewrite(req *sftp.Request) (io.WriterAt, error) {
	abs, err := j.jail(req.Filepath)
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(filepath.Dir(abs), 0o755); err != nil {
		return nil, err
	}
	return os.OpenFile(abs, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o644)
}

func (j *jailFS) Filecmd(req *sftp.Request) error {
	abs, err := j.jail(req.Filepath)
	if err != nil {
		return err
	}
	switch req.Method {
	case "Setstat":
		return nil
	case "Rename":
		dst, err := j.jail(req.Target)
		if err != nil {
			return err
		}
		if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
			return err
		}
		return os.Rename(abs, dst)
	case "Rmdir":
		return os.Remove(abs)
	case "Remove":
		return os.Remove(abs)
	case "Mkdir":
		return os.MkdirAll(abs, 0o755)
	case "Symlink":
		return os.ErrPermission
	default:
		return os.ErrPermission
	}
}

func (j *jailFS) Filelist(req *sftp.Request) (sftp.ListerAt, error) {
	abs, err := j.jail(req.Filepath)
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
			fi, err := e.Info()
			if err != nil {
				continue
			}
			infos = append(infos, fi)
		}
		return listerAt(infos), nil
	case "Stat":
		fi, err := os.Stat(abs)
		if err != nil {
			return nil, err
		}
		return listerAt([]os.FileInfo{fi}), nil
	case "Readlink":
		return nil, os.ErrPermission
	}
	return nil, os.ErrPermission
}

type listerAt []os.FileInfo

func (l listerAt) ListAt(out []os.FileInfo, offset int64) (int, error) {
	if int(offset) >= len(l) {
		return 0, io.EOF
	}
	n := copy(out, l[offset:])
	if n+int(offset) >= len(l) {
		return n, io.EOF
	}
	return n, nil
}

// loadOrCreateHostKey reads (or generates and writes) an Ed25519 host key
// next to the daemon config file. Permissions on the file are 0600.
func loadOrCreateHostKey(cfg *config.Config) (ssh.Signer, error) {
	keyPath := filepath.Join(filepath.Dir(config.DefaultPath()), "sftp-host-ed25519")
	data, err := os.ReadFile(keyPath)
	if err == nil {
		signer, err := ssh.ParsePrivateKey(data)
		if err == nil {
			return signer, nil
		}
	}

	_, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("generate host key: %w", err)
	}
	pemBlock, err := ssh.MarshalPrivateKey(priv, "stellar-daemon")
	if err != nil {
		return nil, fmt.Errorf("marshal host key: %w", err)
	}
	pemBytes := pem.EncodeToMemory(pemBlock)
	if err := os.MkdirAll(filepath.Dir(keyPath), 0o700); err != nil {
		return nil, err
	}
	if err := os.WriteFile(keyPath, pemBytes, 0o600); err != nil {
		return nil, fmt.Errorf("persist host key: %w", err)
	}
	return ssh.NewSignerFromKey(priv)
}

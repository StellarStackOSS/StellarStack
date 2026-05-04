// Package sftp hosts the daemon's SFTP listener. Authentication is the
// same per-node JWT used for the browser console: the SFTP client puts
// the JWT in the password field and `<userId>.<serverId>` in the
// username. The daemon verifies the JWT against the node's signing key,
// requires the `sftp` scope, and chroots into the per-server bind
// directory.
package sftp

import (
	"crypto/ecdsa"
	"crypto/elliptic"
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

	"crypto/x509"

	pkgsftp "github.com/pkg/sftp"
	"golang.org/x/crypto/ssh"

	stellarjwt "github.com/stellarstack/daemon/internal/jwt"
)

// Server is the per-daemon SFTP listener. Construct with New, then call
// ListenAndServe in a goroutine.
type Server struct {
	listen    string
	hostKey   ssh.Signer
	verifier  *stellarjwt.Verifier
	dataDir   string
	nodeID    string
}

// New configures the SFTP server. If `hostKeyPath` doesn't exist a
// fresh ECDSA key is generated and written so the daemon's host
// fingerprint stays stable across restarts.
func New(params struct {
	Listen      string
	HostKeyPath string
	Verifier    *stellarjwt.Verifier
	DataDir     string
	NodeID      string
}) (*Server, error) {
	signer, err := loadOrCreateHostKey(params.HostKeyPath)
	if err != nil {
		return nil, fmt.Errorf("host key: %w", err)
	}
	return &Server{
		listen:   params.Listen,
		hostKey:  signer,
		verifier: params.Verifier,
		dataDir:  params.DataDir,
		nodeID:   params.NodeID,
	}, nil
}

// ListenAndServe binds the SFTP listener. Blocks until the listener is
// closed. Per-connection sessions run in their own goroutines.
func (s *Server) ListenAndServe() error {
	cfg := &ssh.ServerConfig{
		PasswordCallback: s.passwordCallback,
	}
	cfg.AddHostKey(s.hostKey)
	ln, err := net.Listen("tcp", s.listen)
	if err != nil {
		return fmt.Errorf("listen: %w", err)
	}
	log.Printf("sftp: listening on %s", s.listen)
	for {
		conn, err := ln.Accept()
		if err != nil {
			return err
		}
		go s.handleConn(conn, cfg)
	}
}

// passwordCallback verifies the JWT presented as the password. Returns
// the parsed claims via Permissions so the session handler doesn't have
// to reparse them.
func (s *Server) passwordCallback(c ssh.ConnMetadata, password []byte) (*ssh.Permissions, error) {
	parts := strings.SplitN(c.User(), ".", 2)
	if len(parts) != 2 {
		return nil, errors.New("invalid username (expected <userId>.<serverId>)")
	}
	serverID := parts[1]
	claims, err := s.verifier.Verify(string(password))
	if err != nil {
		return nil, fmt.Errorf("invalid token: %w", err)
	}
	if claims.Server != serverID || claims.Node != s.nodeID {
		return nil, errors.New("token scoped to different server/node")
	}
	if !claims.HasScope("sftp") {
		return nil, errors.New("token missing sftp scope")
	}
	return &ssh.Permissions{
		Extensions: map[string]string{
			"server-id": serverID,
		},
	}, nil
}

func (s *Server) handleConn(c net.Conn, cfg *ssh.ServerConfig) {
	defer c.Close()
	sshConn, chans, reqs, err := ssh.NewServerConn(c, cfg)
	if err != nil {
		return
	}
	defer sshConn.Close()
	go ssh.DiscardRequests(reqs)

	serverID := sshConn.Permissions.Extensions["server-id"]
	root := filepath.Join(s.dataDir, "servers", serverID)
	if _, err := os.Stat(root); err != nil {
		log.Printf("sftp: server root missing: %s", root)
		return
	}

	for newChan := range chans {
		if newChan.ChannelType() != "session" {
			_ = newChan.Reject(ssh.UnknownChannelType, "only session channels are accepted")
			continue
		}
		ch, channelReqs, err := newChan.Accept()
		if err != nil {
			continue
		}
		go func() {
			defer ch.Close()
			// Wait for the SFTP subsystem request before serving.
			for req := range channelReqs {
				if req.Type == "subsystem" && len(req.Payload) >= 4 &&
					string(req.Payload[4:]) == "sftp" {
					_ = req.Reply(true, nil)
					if err := serveSFTP(ch, root); err != nil && err != io.EOF {
						log.Printf("sftp: serve: %v", err)
					}
					return
				}
				_ = req.Reply(false, nil)
			}
		}()
	}
}

// serveSFTP runs pkg/sftp against a Channel, with all paths confined to
// `root`. The chroot is implemented via a custom Handlers struct so the
// SFTP layer can never see anything above `root`.
func serveSFTP(ch ssh.Channel, root string) error {
	handlers := chrootHandlers(root)
	srv := pkgsftp.NewRequestServer(ch, handlers)
	return srv.Serve()
}

func chrootHandlers(root string) pkgsftp.Handlers {
	root = filepath.Clean(root)
	resolve := func(p string) (string, error) {
		clean := filepath.Clean("/" + p)
		abs := filepath.Join(root, clean)
		if !strings.HasPrefix(abs, root) {
			return "", fmt.Errorf("path escapes root: %s", p)
		}
		return abs, nil
	}
	fs := &chrootFS{root: root, resolve: resolve}
	return pkgsftp.Handlers{
		FileGet:  fs,
		FilePut:  fs,
		FileCmd:  fs,
		FileList: fs,
	}
}

// loadOrCreateHostKey reads an existing PEM-encoded ECDSA key or
// generates a fresh one and writes it.
func loadOrCreateHostKey(path string) (ssh.Signer, error) {
	if raw, err := os.ReadFile(path); err == nil {
		signer, err := ssh.ParsePrivateKey(raw)
		if err != nil {
			return nil, fmt.Errorf("parse: %w", err)
		}
		return signer, nil
	}
	priv, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("generate: %w", err)
	}
	der, err := x509.MarshalECPrivateKey(priv)
	if err != nil {
		return nil, err
	}
	pemBytes := pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: der})
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return nil, err
	}
	if err := os.WriteFile(path, pemBytes, 0o600); err != nil {
		return nil, err
	}
	return ssh.ParsePrivateKey(pemBytes)
}

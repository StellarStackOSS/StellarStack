// Package ws maintains the persistent WebSocket the daemon dials home to
// the API. Authentication is HMAC-SHA256 over `${nodeId}.${unixSeconds}`
// keyed on the per-node signing secret established at pair time, presented
// as query params on the upgrade request.
package ws

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math"
	"net/url"
	"sync"
	"time"

	"github.com/coder/websocket"

	"github.com/stellarstack/daemon/internal/config"
	"github.com/stellarstack/daemon/internal/handler"
)

// Envelope is the wire shape mirrored from packages/daemon-proto/src/messages.types.ts.
type Envelope struct {
	ID      string          `json:"id"`
	Message json.RawMessage `json:"message"`
}

// HelloMessage is the first frame the daemon sends after connecting.
type HelloMessage struct {
	Type            string   `json:"type"`
	NodeID          string   `json:"nodeId"`
	DaemonVersion   string   `json:"daemonVersion"`
	ProtocolVersion int      `json:"protocolVersion"`
	Capabilities    []string `json:"capabilities"`
}

// Client is the daemon-side handle to the worker/API control channel.
type Client struct {
	cfg     *config.Config
	handler *handler.Handler
}

// New returns a Client bound to the given config.
func New(cfg *config.Config) *Client {
	return &Client{cfg: cfg, handler: handler.New(cfg)}
}

// Handler exposes the underlying message handler so the console HTTP
// server can share its container/lifecycle state.
func (c *Client) Handler() *handler.Handler {
	return c.handler
}

// connSender wraps mutex-guarded writes to the same socket so concurrent
// handler goroutines can push frames without racing.
type connSender struct {
	mu   *sync.Mutex
	conn *websocket.Conn
}

func (s *connSender) Send(ctx context.Context, payload []byte) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.conn.Write(ctx, websocket.MessageText, payload)
}

// Run dials the API control WS and keeps the connection alive until ctx is
// cancelled. Reconnect uses exponential backoff capped at 30s.
func (c *Client) Run(ctx context.Context) error {
	if c.cfg.SigningKeyHex == "" {
		return errors.New(
			"daemon is not paired — run `stellar-daemon configure <token>`",
		)
	}
	backoff := time.Second
	for {
		err := c.connectAndServe(ctx)
		if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
			return nil
		}
		log.Printf("ws session ended: %v (reconnecting in %s)", err, backoff)
		select {
		case <-ctx.Done():
			return nil
		case <-time.After(backoff):
		}
		backoff = time.Duration(math.Min(float64(backoff*2), float64(30*time.Second)))
	}
}

func (c *Client) connectAndServe(ctx context.Context) error {
	endpoint, err := c.buildAuthedURL()
	if err != nil {
		return err
	}
	dialCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	conn, _, err := websocket.Dial(dialCtx, endpoint, nil)
	if err != nil {
		return fmt.Errorf("dial %s: %w", endpoint, err)
	}
	defer conn.Close(websocket.StatusNormalClosure, "shutdown")

	writeMu := &sync.Mutex{}
	sender := &connSender{mu: writeMu, conn: conn}
	c.handler.SetSender(sender)

	hello := Envelope{ID: ""}
	helloBody, err := json.Marshal(HelloMessage{
		Type:            "daemon.hello",
		NodeID:          c.cfg.NodeID,
		DaemonVersion:   config.Version,
		ProtocolVersion: 1,
		Capabilities:    []string{"docker", "sftp", "lifecycle"},
	})
	if err != nil {
		return fmt.Errorf("marshal hello: %w", err)
	}
	hello.Message = helloBody
	helloBytes, err := json.Marshal(hello)
	if err != nil {
		return fmt.Errorf("marshal envelope: %w", err)
	}
	if err := sender.Send(ctx, helloBytes); err != nil {
		return fmt.Errorf("send hello: %w", err)
	}

	// Reconcile on connect and then every 2 minutes so the DB/panel always
	// reflect actual Docker container states even if a state-change event was
	// missed (e.g. after a daemon crash or a dropped WS frame).
	go c.handler.Resume(ctx)
	reconcileTicker := time.NewTicker(2 * time.Minute)
	defer reconcileTicker.Stop()

	heartbeat := time.NewTicker(30 * time.Second)
	defer heartbeat.Stop()

	type readResult struct {
		data []byte
		err  error
	}
	reads := make(chan readResult)
	go func() {
		for {
			_, data, err := conn.Read(ctx)
			reads <- readResult{data: data, err: err}
			if err != nil {
				return
			}
		}
	}()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case r := <-reads:
			if r.err != nil {
				return r.err
			}
			go func(payload []byte) {
				if err := c.handler.HandleEnvelope(ctx, payload, sender); err != nil {
					log.Printf("daemon: handle envelope: %v", err)
				}
			}(r.data)
		case <-reconcileTicker.C:
			go c.handler.Reconcile(ctx)
		case <-heartbeat.C:
			if err := conn.Ping(ctx); err != nil {
				return fmt.Errorf("ping: %w", err)
			}
		}
	}
}

func (c *Client) buildAuthedURL() (string, error) {
	if c.cfg.WebsocketURL == "" {
		return "", errors.New("config is missing websocketUrl")
	}
	parsed, err := url.Parse(c.cfg.WebsocketURL)
	if err != nil {
		return "", fmt.Errorf("parse ws url: %w", err)
	}
	timestamp := fmt.Sprintf("%d", time.Now().Unix())
	signature, err := signMessage(c.cfg.SigningKeyHex, c.cfg.NodeID+"."+timestamp)
	if err != nil {
		return "", err
	}
	q := parsed.Query()
	q.Set("node", c.cfg.NodeID)
	q.Set("ts", timestamp)
	q.Set("sig", signature)
	parsed.RawQuery = q.Encode()
	return parsed.String(), nil
}

func signMessage(keyHex, message string) (string, error) {
	key, err := hex.DecodeString(keyHex)
	if err != nil {
		return "", fmt.Errorf("decode signing key: %w", err)
	}
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(message))
	return hex.EncodeToString(mac.Sum(nil)), nil
}

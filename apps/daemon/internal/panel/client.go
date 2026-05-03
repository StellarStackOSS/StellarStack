// Package panel is the daemon's outbound HTTP client for talking to the
// API. Currently we only push container-status callbacks; install log
// streaming is response-bound (the API initiated the request) so it
// doesn't go through here.
package panel

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// Client posts daemon-originated events to the API. Authentication is
// HMAC-SHA256 over `<nodeId>|<unix-seconds>` keyed on the per-node
// signing key. The API verifies with the same key it gave the daemon at
// pair time.
type Client struct {
	baseURL    string
	nodeID     string
	signingKey []byte
	http       *http.Client
}

func New(baseURL, nodeID, signingKeyHex string) (*Client, error) {
	key, err := hex.DecodeString(signingKeyHex)
	if err != nil {
		return nil, fmt.Errorf("decode signing key: %w", err)
	}
	return &Client{
		baseURL:    strings.TrimRight(baseURL, "/"),
		nodeID:     nodeID,
		signingKey: key,
		http:       &http.Client{Timeout: 10 * time.Second},
	}, nil
}

// PushStatus sends a state-change callback. Best-effort; the caller logs
// + ignores transient failures because reconcile-on-reconnect would
// re-converge anyway.
func (c *Client) PushStatus(ctx context.Context, serverUUID, prev, next string) error {
	body, err := json.Marshal(map[string]any{
		"previousState": prev,
		"newState":      next,
		"at":            time.Now().UTC().Format(time.RFC3339Nano),
	})
	if err != nil {
		return err
	}
	req, err := c.signedRequest(ctx, http.MethodPost,
		fmt.Sprintf("/api/remote/servers/%s/container/status", serverUUID),
		body)
	if err != nil {
		return err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return fmt.Errorf("panel push status %s: %s", resp.Status, string(raw))
	}
	return nil
}

func (c *Client) signedRequest(ctx context.Context, method, path string, body []byte) (*http.Request, error) {
	url := c.baseURL + path
	var rdr io.Reader
	if body != nil {
		rdr = bytes.NewReader(body)
	}
	req, err := http.NewRequestWithContext(ctx, method, url, rdr)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	ts := fmt.Sprintf("%d", time.Now().Unix())
	mac := hmac.New(sha256.New, c.signingKey)
	mac.Write([]byte(c.nodeID + "|" + ts))
	sig := hex.EncodeToString(mac.Sum(nil))
	req.Header.Set("X-Stellar-Node-Id", c.nodeID)
	req.Header.Set("X-Stellar-Timestamp", ts)
	req.Header.Set("Authorization", "Bearer "+sig)
	return req, nil
}

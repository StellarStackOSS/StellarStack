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

// ServerConfig mirrors the API's GET /api/remote/servers/:id/config
// response. The daemon doesn't keep server config in its own state
// store — it pulls fresh on each power action so a panel-side change
// (memory bump, blueprint swap, variable update) lands on the next
// start without operator intervention.
type ServerConfig struct {
	DockerImage     string            `json:"dockerImage"`
	StartupCommand  string            `json:"startupCommand"`
	Environment     map[string]string `json:"environment"`
	Stop            StopConfig        `json:"stop"`
	MemoryLimitMb   int64             `json:"memoryLimitMb"`
	CPULimitPercent int64             `json:"cpuLimitPercent"`
	Ports           []PortMapping     `json:"ports"`
	// Console patterns the daemon scans for to detect the application-
	// level "ready" signal. On match the server flips Starting →
	// Running. Empty array → fall back to "running once Docker reports
	// the container up" so blueprints without a lifecycle block don't
	// wedge in starting.
	StartupDone []DonePattern `json:"startupDone"`
	// Blueprint configFiles the daemon patches before every start.
	// Each entry's `patches` map values can reference {{ENV_VAR}} for
	// substitution against the resolved environment.
	ConfigFiles []ConfigFile `json:"configFiles"`
}

type DonePattern struct {
	Type  string `json:"type"`
	Value string `json:"value"`
	Flags string `json:"flags"`
}

type ConfigFile struct {
	Path    string            `json:"path"`
	Parser  string            `json:"parser"`
	Patches map[string]string `json:"patches"`
}

// StopConfig matches environment.StopConfig on the wire.
type StopConfig struct {
	Type  string `json:"type"`
	Value string `json:"value"`
}

// PortMapping matches docker.PortMapping on the wire.
type PortMapping struct {
	HostIP        string `json:"hostIp"`
	HostPort      int    `json:"hostPort"`
	ContainerPort int    `json:"containerPort"`
}

// FetchServerConfig pulls the API's authoritative server runtime
// config so the daemon can configure the docker container without the
// browser carrying that data over the WS.
func (c *Client) FetchServerConfig(ctx context.Context, serverUUID string) (*ServerConfig, error) {
	req, err := c.signedRequest(ctx, http.MethodGet,
		fmt.Sprintf("/api/remote/servers/%s/config", serverUUID), nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return nil, fmt.Errorf("panel fetch config %s: %s", resp.Status, string(raw))
	}
	var cfg ServerConfig
	if err := json.NewDecoder(resp.Body).Decode(&cfg); err != nil {
		return nil, err
	}
	return &cfg, nil
}

// Heartbeat tells the API "this node is alive". POSTed by the daemon
// on startup and on a 30s ticker so the admin nodes page can render an
// online/offline pill backed by a fresh `connected_at` row column.
func (c *Client) Heartbeat(ctx context.Context) error {
	req, err := c.signedRequest(ctx, http.MethodPost, "/api/remote/heartbeat", nil)
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
		return fmt.Errorf("panel heartbeat %s: %s", resp.Status, string(raw))
	}
	return nil
}

// PushAudit posts an audit-log entry for the supplied server. Best-effort
// — the daemon-WS power-action handler calls this immediately after
// enqueuing the action so the activity tab gets a timestamped row even
// when the action completes long after.
func (c *Client) PushAudit(ctx context.Context, serverUUID, actorID, action string, metadata map[string]any) error {
	payload := map[string]any{
		"actorId": nil,
		"action":  action,
	}
	if actorID != "" {
		payload["actorId"] = actorID
	}
	if metadata != nil {
		payload["metadata"] = metadata
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := c.signedRequest(ctx, http.MethodPost,
		fmt.Sprintf("/api/remote/servers/%s/audit", serverUUID),
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
		return fmt.Errorf("panel push audit %s: %s", resp.Status, string(raw))
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

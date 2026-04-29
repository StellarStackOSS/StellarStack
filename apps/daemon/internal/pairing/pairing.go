// Package pairing implements `stellar-daemon configure <token>`. The daemon
// posts the one-time pairing JWT to the API, receives the per-node signing
// secret + websocket URL + node id, and persists the result to the on-disk
// config.
package pairing

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/stellarstack/daemon/internal/config"
)

// ClaimResponse mirrors the JSON returned by `POST /daemon/pair`.
type ClaimResponse struct {
	NodeID       string `json:"nodeId"`
	NodeName     string `json:"nodeName"`
	SigningKey   string `json:"signingKey"`
	WebsocketURL string `json:"websocketUrl"`
}

// apiErrorEnvelope mirrors the canonical ApiError wire shape so failures are
// surfaced with their translation key intact (the daemon prints the key
// rather than translating; operators can paste the key into bug reports).
type apiErrorEnvelope struct {
	Error struct {
		Code      string `json:"code"`
		RequestID string `json:"requestId"`
	} `json:"error"`
}

// Claim performs the pair-token claim and writes the resulting config to
// disk. `apiURL` defaults to whatever the existing config has (or the dev
// default if there is none).
func Claim(token string, apiURLOverride string) error {
	if strings.TrimSpace(token) == "" {
		return errors.New("token is required")
	}

	existing, err := config.Load()
	if err != nil {
		return err
	}

	apiURL := strings.TrimRight(existing.APIURL, "/")
	if apiURLOverride != "" {
		apiURL = strings.TrimRight(apiURLOverride, "/")
	}
	if apiURL == "" {
		apiURL = "http://localhost:3000"
	}

	endpoint, err := url.JoinPath(apiURL, "daemon", "pair")
	if err != nil {
		return fmt.Errorf("build pair endpoint: %w", err)
	}

	payload, err := json.Marshal(map[string]string{"token": token})
	if err != nil {
		return fmt.Errorf("marshal payload: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("new request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "stellar-daemon/"+config.Version)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("call pair endpoint: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode/100 != 2 {
		var envelope apiErrorEnvelope
		if jsonErr := json.Unmarshal(body, &envelope); jsonErr == nil &&
			envelope.Error.Code != "" {
			return fmt.Errorf(
				"pair rejected (%s, request %s)",
				envelope.Error.Code,
				envelope.Error.RequestID,
			)
		}
		return fmt.Errorf("pair rejected: HTTP %d", resp.StatusCode)
	}

	var claim ClaimResponse
	if err := json.Unmarshal(body, &claim); err != nil {
		return fmt.Errorf("parse response: %w", err)
	}
	if claim.NodeID == "" || claim.SigningKey == "" {
		return errors.New("pair response missing required fields")
	}

	cfg := existing
	cfg.NodeID = claim.NodeID
	cfg.NodeName = claim.NodeName
	cfg.APIURL = apiURL
	cfg.WebsocketURL = claim.WebsocketURL
	cfg.SigningKeyHex = claim.SigningKey

	if err := config.Save(cfg); err != nil {
		return err
	}
	fmt.Printf("Paired as node %q (%s)\n", claim.NodeName, claim.NodeID)
	fmt.Printf("Configuration written to %s\n", config.DefaultPath())
	return nil
}

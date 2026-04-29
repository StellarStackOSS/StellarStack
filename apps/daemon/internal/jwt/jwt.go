// Package jwt verifies the short-lived JWTs the API mints for direct daemon
// access (console, files, SFTP, transfers). The signing key is established
// at pairing time and stored in the daemon config. All inbound user
// requests revalidate scope on every frame.
package jwt

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

// Claims is the subset of daemon-bound JWT claims the daemon validates
// before granting access. Mirrors @workspace/shared/jwt.types.DaemonJwtClaims.
type Claims struct {
	Sub    string   `json:"sub"`
	Server string   `json:"server"`
	Node   string   `json:"node"`
	Scope  []string `json:"scope"`
	Iat    int64    `json:"iat"`
	Exp    int64    `json:"exp"`
	Jti    string   `json:"jti"`
}

// HasScope returns true if the claims include the named scope.
func (c *Claims) HasScope(scope string) bool {
	for _, s := range c.Scope {
		if s == scope {
			return true
		}
	}
	return false
}

// Verifier validates JWTs against the per-node signing secret.
type Verifier struct {
	keyHex string
	nodeID string
}

// New returns a Verifier bound to the per-node signing secret + node id.
func New(keyHex, nodeID string) *Verifier {
	return &Verifier{keyHex: keyHex, nodeID: nodeID}
}

// Verify decodes and validates a compact JWS. The token must use HS256,
// be signed by the per-node key, target this node, and not be expired.
func (v *Verifier) Verify(token string) (*Claims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, errors.New("malformed jwt")
	}
	headerJSON, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, fmt.Errorf("decode header: %w", err)
	}
	var header struct {
		Alg string `json:"alg"`
	}
	if err := json.Unmarshal(headerJSON, &header); err != nil {
		return nil, fmt.Errorf("decode header json: %w", err)
	}
	if header.Alg != "HS256" {
		return nil, fmt.Errorf("unsupported alg %q", header.Alg)
	}

	signingInput := []byte(parts[0] + "." + parts[1])
	expectedSig, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return nil, fmt.Errorf("decode signature: %w", err)
	}
	key, err := hex.DecodeString(v.keyHex)
	if err != nil {
		return nil, fmt.Errorf("decode signing key: %w", err)
	}
	mac := hmac.New(sha256.New, key)
	mac.Write(signingInput)
	if !hmac.Equal(mac.Sum(nil), expectedSig) {
		return nil, errors.New("signature mismatch")
	}

	payloadJSON, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, fmt.Errorf("decode payload: %w", err)
	}
	var claims Claims
	if err := json.Unmarshal(payloadJSON, &claims); err != nil {
		return nil, fmt.Errorf("decode payload json: %w", err)
	}
	if claims.Node != v.nodeID {
		return nil, errors.New("token bound to a different node")
	}
	if claims.Exp != 0 && time.Now().Unix() >= claims.Exp {
		return nil, errors.New("token expired")
	}
	return &claims, nil
}

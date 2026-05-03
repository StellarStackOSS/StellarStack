// Package jwt verifies short-lived HMAC-SHA256 JWTs minted by the API for
// browser → daemon access. Each node has its own signing key, established
// at pair time and stored on disk, so a compromised node cannot forge
// tokens for another node.
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

// Claims mirrors @workspace/shared/jwt.types.DaemonJwtClaims.
type Claims struct {
	Sub    string   `json:"sub"`
	Server string   `json:"server"`
	Node   string   `json:"node"`
	Scope  []string `json:"scope"`
	Iat    int64    `json:"iat"`
	Exp    int64    `json:"exp"`
	Jti    string   `json:"jti"`
}

// HasScope reports whether the supplied scope is present on the token.
func (c *Claims) HasScope(want string) bool {
	for _, s := range c.Scope {
		if s == want {
			return true
		}
	}
	return false
}

// Verifier validates HS256 tokens against the daemon's local signing key.
// Construct with New(); Verify is goroutine-safe.
type Verifier struct {
	key []byte
}

// New returns a Verifier bound to the supplied hex-encoded HMAC key.
func New(hexKey string) (*Verifier, error) {
	key, err := hex.DecodeString(hexKey)
	if err != nil {
		return nil, fmt.Errorf("decode signing key: %w", err)
	}
	if len(key) == 0 {
		return nil, errors.New("signing key is empty")
	}
	return &Verifier{key: key}, nil
}

// Verify parses, validates the signature, and returns the claims. Returns
// an error if the token is malformed, the signature is wrong, the algorithm
// is not HS256, or the token is expired.
func (v *Verifier) Verify(token string) (*Claims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, errors.New("token must have three segments")
	}

	headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, fmt.Errorf("decode header: %w", err)
	}
	var header struct {
		Alg string `json:"alg"`
		Typ string `json:"typ"`
	}
	if err := json.Unmarshal(headerBytes, &header); err != nil {
		return nil, fmt.Errorf("parse header: %w", err)
	}
	if header.Alg != "HS256" {
		return nil, fmt.Errorf("unsupported alg %q", header.Alg)
	}

	signingInput := parts[0] + "." + parts[1]
	expected := hmacSHA256(v.key, []byte(signingInput))
	provided, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return nil, fmt.Errorf("decode signature: %w", err)
	}
	if !hmac.Equal(expected, provided) {
		return nil, errors.New("signature mismatch")
	}

	claimsBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, fmt.Errorf("decode claims: %w", err)
	}
	var claims Claims
	if err := json.Unmarshal(claimsBytes, &claims); err != nil {
		return nil, fmt.Errorf("parse claims: %w", err)
	}
	if claims.Exp > 0 && time.Now().Unix() >= claims.Exp {
		return nil, errors.New("token expired")
	}
	return &claims, nil
}

func hmacSHA256(key, data []byte) []byte {
	mac := hmacNew(key)
	mac.Write(data)
	return mac.Sum(nil)
}

// hmacNew is split out so tests can swap in deterministic HMAC instances.
func hmacNew(key []byte) interface {
	Write([]byte) (int, error)
	Sum([]byte) []byte
} {
	return hmac.New(sha256.New, key)
}

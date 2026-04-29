// Package jwt verifies the short-lived JWTs the API mints for direct daemon
// access (console, files, SFTP, transfers). The signing key is established
// at pairing time and stored in the daemon config. All inbound user
// requests revalidate scope on every frame.
package jwt

// Verifier checks JWT signatures against the per-node signing key and
// enforces required scopes on each frame. Implementation pending.
type Verifier struct{}

// New returns a default Verifier. Implementation pending.
func New() *Verifier {
	return &Verifier{}
}

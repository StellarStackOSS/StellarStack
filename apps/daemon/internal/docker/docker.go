// Package docker wraps the Docker SDK with the small subset of operations
// the daemon performs: create/start/stop/kill/delete containers, attach
// stdio, tail logs, and stream stats. Real implementation lands in the
// "Provision a server" milestone.
package docker

// Client is the daemon-side handle to the Docker daemon. Methods are added
// alongside the milestones that need them; this stub exists so the package
// can be imported and built immediately.
type Client struct{}

// New returns a Client connected to the local Docker daemon via the default
// socket path. Implementation pending.
func New() *Client {
	return &Client{}
}

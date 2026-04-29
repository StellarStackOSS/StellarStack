// Package ws owns the persistent WebSocket the daemon dials home to the
// worker, plus the per-server WS that browsers connect to directly for live
// console and stats. Real implementation lands alongside the lifecycle and
// console milestones.
package ws

// Client is the daemon-side WebSocket client that maintains a persistent
// connection to the worker. Implementation pending.
type Client struct{}

// New returns a default Client. Implementation pending.
func New() *Client {
	return &Client{}
}

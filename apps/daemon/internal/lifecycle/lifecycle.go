// Package lifecycle implements the per-server probe watcher that drives the
// installing/starting/running/stopping/stopped/crashed state machine. Each
// server gets one Watcher, which arms the appropriate probe set on each
// transition, fans probe results into a single state stream, and emits
// `server.state_changed` messages back to the worker. Implementation lands
// alongside the "Live console + power actions + lifecycle" milestone.
package lifecycle

// Watcher owns the active probe set for a single server.
type Watcher struct{}

// New returns a default Watcher. Implementation pending.
func New() *Watcher {
	return &Watcher{}
}

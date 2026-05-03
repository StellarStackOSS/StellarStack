// Package environment owns Docker-side state for one server: the
// container name, the resolved stop policy, and the synchronous power
// chain (Stop, WaitForStop, Start, Terminate). Mirrors the shape of
// Wings' DockerEnvironment without copying its code.
package environment

import (
	"sync"

	"github.com/stellarstack/daemon/internal/docker"
)

// State enumerates the four states the lifecycle exposes. Aligns 1:1
// with @workspace/shared/events.types.ServerLifecycleState.
type State string

const (
	StateOffline  State = "offline"
	StateStarting State = "starting"
	StateRunning  State = "running"
	StateStopping State = "stopping"
)

// Stop describes how this server is shut down. Type "command" writes
// `Value\n` to the container stdin; type "signal" sends the named signal
// via Docker's kill API; type "" (empty) lets Docker's stop API use the
// container's configured StopSignal. Mirrors Pelican's StopConfig union.
type StopConfig struct {
	Type  string // "" | "command" | "signal"
	Value string // command text without trailing \n, or signal name like "SIGTERM"
}

// StateListener is invoked on every transition. The Server type registers
// a listener that broadcasts to subscribers and posts to the panel.
type StateListener func(prev, next State)

// Environment is the per-server Docker handle.
type Environment struct {
	docker        *docker.Client
	containerName string

	mu       sync.RWMutex
	state    State
	stop     StopConfig
	listener StateListener
}

func New(d *docker.Client, containerName string) *Environment {
	return &Environment{
		docker:        d,
		containerName: containerName,
		state:         StateOffline,
	}
}

// State returns the current state. Snapshot — value may have changed by
// the time the caller reads it.
func (e *Environment) State() State {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.state
}

// SetListener installs the state-change listener. Replaces any prior
// listener.
func (e *Environment) SetListener(l StateListener) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.listener = l
}

// SetStop replaces the stop policy. Called when the API hands the daemon
// a fresh server config (start payload).
func (e *Environment) SetStop(s StopConfig) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.stop = s
}

// Stop returns the active stop policy.
func (e *Environment) Stop() StopConfig {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.stop
}

// ContainerName returns the docker container name (e.g. "stellar-<uuid>").
func (e *Environment) ContainerName() string { return e.containerName }

// Docker returns the underlying client. Used by the install path that
// runs an unrelated one-shot container under the daemon's control.
func (e *Environment) Docker() *docker.Client { return e.docker }

// setState writes the new state and notifies the listener if the value
// actually changed. Skips the notify on no-op transitions so reconcile
// cannot publish "running -> running" frames that the panel would
// re-render as a fresh transition.
func (e *Environment) setState(next State) {
	e.mu.Lock()
	prev := e.state
	if prev == next {
		e.mu.Unlock()
		return
	}
	e.state = next
	listener := e.listener
	e.mu.Unlock()
	if listener != nil {
		listener(prev, next)
	}
}

// ForceState is the reconcile-on-startup hook: it always notifies, even
// when prev == next, so the API/DB picks up actual Docker state after a
// daemon restart even if the watcher's default already matches reality.
func (e *Environment) ForceState(next State) {
	e.mu.Lock()
	prev := e.state
	e.state = next
	listener := e.listener
	e.mu.Unlock()
	if listener != nil {
		listener(prev, next)
	}
}

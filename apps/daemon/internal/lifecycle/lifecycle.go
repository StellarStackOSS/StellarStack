// Package lifecycle implements the per-server probe watcher that drives the
// installed_stopped → starting → running → stopping → stopped state
// machine. Each server gets one Watcher; on each transition the Watcher
// arms the matching probe set declared in the blueprint, evaluates probes
// (console regex, container_exit, others stubbed), and emits
// server.state_changed envelopes back to the API via the supplied Sender.
package lifecycle

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"regexp"
	"sync"
	"time"

	"github.com/stellarstack/daemon/internal/docker"
)

// Sender writes a JSON envelope back to the API over the daemon's WS.
type Sender interface {
	Send(ctx context.Context, payload []byte) error
}

// State mirrors @workspace/shared/events.types.ServerLifecycleState.
type State string

const (
	StateInstalledStopped State = "installed_stopped"
	StateStarting         State = "starting"
	StateRunning          State = "running"
	StateStopping         State = "stopping"
	StateStopped          State = "stopped"
	StateCrashed          State = "crashed"
)

// Match describes a console-regex / substring match descriptor.
type Match struct {
	Type    string `json:"type"`
	Pattern string `json:"pattern"`
	Value   string `json:"value"`
	Flags   string `json:"flags"`
}

// Probe is one strategy/criteria pair from the blueprint.
type Probe struct {
	Strategy      string  `json:"strategy"`
	Match         Match   `json:"match"`
	IfNotInState  []State `json:"ifNotInState"`
}

// Phase is one of starting/stopping/crashDetection.
type Phase struct {
	Probes         []Probe `json:"probes"`
	IntervalMs     int     `json:"intervalMs"`
	TimeoutMs      int     `json:"timeoutMs"`
	GraceTimeoutMs int     `json:"graceTimeoutMs"`
	OnTimeout      string  `json:"onTimeout"`
}

// Lifecycle is the full lifecycle declaration parsed off the blueprint.
type Lifecycle struct {
	Starting        Phase `json:"starting"`
	Stopping        Phase `json:"stopping"`
	CrashDetection  Phase `json:"crashDetection"`
}

// Watcher owns the active probe set for a single server.
type Watcher struct {
	containerName string
	serverID      string
	docker        *docker.Client
	send          Sender

	mu          sync.Mutex
	state       State
	cancel      context.CancelFunc
	statsCancel context.CancelFunc
}

// New constructs a Watcher in the `installed_stopped` state. Call
// `OnStarting`, `OnStopping`, etc. to drive transitions.
func New(serverID, containerName string, dc *docker.Client, send Sender) *Watcher {
	return &Watcher{
		containerName: containerName,
		serverID:      serverID,
		docker:        dc,
		send:          send,
		state:         StateInstalledStopped,
	}
}

// State returns the current state. Snapshot — value may have changed by
// the time the caller reads it.
func (w *Watcher) State() State {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.state
}

// OnStarting arms the starting probe set. The first probe to match flips
// the state to running and emits a transition; if no probe matches within
// the configured timeout, `onTimeout` decides the next state
// (mark_crashed | mark_stopped | keep_starting).
func (w *Watcher) OnStarting(ctx context.Context, lifecycle Lifecycle) {
	w.beginPhase(ctx, StateStarting, lifecycle.Starting, StateRunning, lifecycle)
}

// OnStopping arms the stopping probe set. First match → stopped. Timeout
// triggers force_kill.
func (w *Watcher) OnStopping(ctx context.Context, lifecycle Lifecycle) {
	w.beginPhase(ctx, StateStopping, lifecycle.Stopping, StateStopped, lifecycle)
}

// Stop cancels any in-flight probe loop. The caller is responsible for
// emitting the corresponding transition (typically via OnStopping/OnStopped).
func (w *Watcher) Stop() {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.cancel != nil {
		w.cancel()
		w.cancel = nil
	}
	if w.statsCancel != nil {
		w.statsCancel()
		w.statsCancel = nil
	}
}

// SetState forces the state without running probes. Used after a
// terminal docker call (e.g. `KillContainer`) so the panel reflects the
// new state without waiting for the lifecycle watcher to converge.
func (w *Watcher) SetState(ctx context.Context, next State, code string) {
	w.mu.Lock()
	prev := w.state
	w.state = next
	w.mu.Unlock()
	if next != StateRunning {
		w.stopStatsStream()
	}
	w.emit(ctx, prev, next, code)
}

// startStatsStream subscribes to the docker stats endpoint for this
// container and emits one server.stats envelope per frame. Replaces any
// prior stream.
func (w *Watcher) startStatsStream() {
	w.stopStatsStream()
	ctx, cancel := context.WithCancel(context.Background())
	w.mu.Lock()
	w.statsCancel = cancel
	w.mu.Unlock()
	go w.runStats(ctx)
}

// stopStatsStream cancels any in-flight stats stream.
func (w *Watcher) stopStatsStream() {
	w.mu.Lock()
	cancel := w.statsCancel
	w.statsCancel = nil
	w.mu.Unlock()
	if cancel != nil {
		cancel()
	}
}

func (w *Watcher) runStats(ctx context.Context) {
	stream, err := w.docker.StatsStream(ctx, w.containerName)
	if err != nil {
		log.Printf("lifecycle: stats stream: %v", err)
		return
	}
	for snapshot := range stream {
		w.emitStats(snapshot)
	}
}

func (w *Watcher) emitStats(snapshot docker.StatsSnapshot) {
	frame := map[string]any{
		"id": "",
		"message": map[string]any{
			"type":             "server.stats",
			"serverId":         w.serverID,
			"memoryBytes":      snapshot.MemoryBytes,
			"memoryLimitBytes": snapshot.MemoryLimitBytes,
			"cpuFraction":      snapshot.CPUFraction,
			"diskBytes":        0,
			"networkRxBytes":   snapshot.NetworkRxBytes,
			"networkTxBytes":   snapshot.NetworkTxBytes,
			"at":               time.Now().UTC().Format(time.RFC3339Nano),
		},
	}
	payload, err := json.Marshal(frame)
	if err != nil {
		return
	}
	if err := w.send.Send(context.Background(), payload); err != nil {
		log.Printf("lifecycle: emit stats: %v", err)
	}
}

func (w *Watcher) beginPhase(
	ctx context.Context,
	transitionTo State,
	phase Phase,
	successState State,
	lifecycle Lifecycle,
) {
	w.Stop()

	w.mu.Lock()
	prev := w.state
	w.state = transitionTo
	phaseCtx, cancel := context.WithCancel(ctx)
	w.cancel = cancel
	w.mu.Unlock()

	w.emit(ctx, prev, transitionTo, fmt.Sprintf("servers.lifecycle.%s.requested", transitionTo))

	go w.runPhase(phaseCtx, phase, successState, lifecycle)
}

func (w *Watcher) runPhase(
	ctx context.Context,
	phase Phase,
	successState State,
	lifecycle Lifecycle,
) {
	results := make(chan probeMatch, 4)
	for _, probe := range phase.Probes {
		go w.runProbe(ctx, probe, lifecycle, results)
	}

	timeout := time.Duration(phase.TimeoutMs) * time.Millisecond
	if timeout == 0 && phase.GraceTimeoutMs > 0 {
		timeout = time.Duration(phase.GraceTimeoutMs) * time.Millisecond
	}
	var timer <-chan time.Time
	if timeout > 0 {
		t := time.NewTimer(timeout)
		defer t.Stop()
		timer = t.C
	}

	select {
	case <-ctx.Done():
		return
	case match := <-results:
		w.transitionTo(ctx, successState, match.code)
		if successState == StateRunning {
			w.startStatsStream()
			if len(lifecycle.CrashDetection.Probes) > 0 {
				w.armCrashDetection(lifecycle)
			}
		} else {
			w.stopStatsStream()
		}
	case <-timer:
		switch phase.OnTimeout {
		case "mark_crashed":
			w.transitionTo(ctx, StateCrashed, "servers.lifecycle.start_timeout")
		case "mark_stopped", "force_kill":
			_ = w.docker.KillContainer(context.Background(), w.containerName)
			w.transitionTo(ctx, StateStopped, "servers.lifecycle.stop_forced")
		case "keep_starting":
			return
		default:
			w.transitionTo(ctx, StateCrashed, "servers.lifecycle.start_timeout")
		}
	}
}

// armCrashDetection runs the crash-detection probe set in the background
// once the server enters `running`. Any matching probe transitions the
// server to `crashed` (or `stopped` when triggered while we're already in
// the stopping path).
func (w *Watcher) armCrashDetection(lifecycle Lifecycle) {
	w.mu.Lock()
	if w.cancel != nil {
		w.cancel()
	}
	ctx, cancel := context.WithCancel(context.Background())
	w.cancel = cancel
	w.mu.Unlock()

	go func() {
		results := make(chan probeMatch, 4)
		for _, probe := range lifecycle.CrashDetection.Probes {
			go w.runProbe(ctx, probe, lifecycle, results)
		}
		select {
		case <-ctx.Done():
			return
		case match := <-results:
			next := StateCrashed
			if w.State() == StateStopping {
				next = StateStopped
			}
			w.transitionTo(ctx, next, match.code)
		}
	}()
}

type probeMatch struct {
	code string
}

func (w *Watcher) runProbe(
	ctx context.Context,
	probe Probe,
	_ Lifecycle,
	out chan<- probeMatch,
) {
	switch probe.Strategy {
	case "console":
		w.runConsoleProbe(ctx, probe, out)
	case "container_exit":
		w.runContainerExitProbe(ctx, probe, out)
	default:
		log.Printf("lifecycle: probe strategy %q not yet implemented", probe.Strategy)
	}
}

func (w *Watcher) runConsoleProbe(
	ctx context.Context,
	probe Probe,
	out chan<- probeMatch,
) {
	var pattern *regexp.Regexp
	if probe.Match.Type == "regex" && probe.Match.Pattern != "" {
		flags := probe.Match.Flags
		if flags == "" {
			flags = ""
		}
		compiled, err := regexp.Compile("(?" + flags + ":" + probe.Match.Pattern + ")")
		if err != nil {
			log.Printf("lifecycle: invalid console regex: %v", err)
			return
		}
		pattern = compiled
	}

	logs, err := w.docker.FollowLogs(ctx, w.containerName)
	if err != nil {
		return
	}
	for line := range logs {
		if probe.Match.Type == "substring" {
			if probe.Match.Value != "" && contains(line.Line, probe.Match.Value) {
				select {
				case out <- probeMatch{code: "servers.lifecycle.console_match"}:
				default:
				}
				return
			}
			continue
		}
		if pattern == nil {
			continue
		}
		if pattern.MatchString(line.Line) {
			select {
			case out <- probeMatch{code: "servers.lifecycle.console_match"}:
			default:
			}
			return
		}
	}
}

func (w *Watcher) runContainerExitProbe(
	ctx context.Context,
	probe Probe,
	out chan<- probeMatch,
) {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			state, err := w.docker.InspectState(ctx, w.containerName)
			if err != nil || state == nil {
				continue
			}
			if state.Running {
				continue
			}
			if len(probe.IfNotInState) > 0 {
				current := w.State()
				skip := false
				for _, s := range probe.IfNotInState {
					if s == current {
						skip = true
						break
					}
				}
				if skip {
					continue
				}
			}
			code := "servers.lifecycle.crashed.container_exit"
			if w.State() == StateStopping {
				code = "servers.lifecycle.stopped"
			}
			select {
			case out <- probeMatch{code: code}:
			default:
			}
			return
		}
	}
}

func (w *Watcher) transitionTo(_ context.Context, next State, code string) {
	w.mu.Lock()
	prev := w.state
	if prev == next {
		w.mu.Unlock()
		return
	}
	w.state = next
	cancel := w.cancel
	w.cancel = nil
	w.mu.Unlock()
	if prev == StateRunning && next != StateRunning {
		w.stopStatsStream()
	}
	w.emit(context.Background(), prev, next, code)
	if cancel != nil {
		cancel()
	}
}

func (w *Watcher) emit(ctx context.Context, from, to State, code string) {
	frame := map[string]any{
		"id": "",
		"message": map[string]any{
			"type":     "server.state_changed",
			"serverId": w.serverID,
			"from":     string(from),
			"to":       string(to),
			"reason":   map[string]any{"code": code},
			"at":       time.Now().UTC().Format(time.RFC3339Nano),
		},
	}
	payload, err := json.Marshal(frame)
	if err != nil {
		return
	}
	if err := w.send.Send(ctx, payload); err != nil {
		log.Printf("lifecycle: emit transition: %v", err)
	}
}

func contains(haystack, needle string) bool {
	return len(haystack) >= len(needle) && stringIndex(haystack, needle) >= 0
}

func stringIndex(haystack, needle string) int {
	for i := 0; i+len(needle) <= len(haystack); i++ {
		if haystack[i:i+len(needle)] == needle {
			return i
		}
	}
	return -1
}

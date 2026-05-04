// Package server owns the per-server in-memory model: state, power
// lock, environment, console history ring buffer, and event bus. One
// Server per managed container; lifetime spans the daemon process.
package server

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"regexp"
	"runtime"
	"sync"
	"time"

	"github.com/stellarstack/daemon/internal/docker"
	"github.com/stellarstack/daemon/internal/environment"
	"github.com/stellarstack/daemon/internal/events"
	"github.com/stellarstack/daemon/internal/panel"
)

// Server holds the runtime state for one managed server.
type Server struct {
	uuid    string
	env     *environment.Environment
	bus     *events.Bus
	history *consoleHistory
	panel   *panel.Client

	powerLock chan struct{}

	cfgMu sync.RWMutex
	cfg   Config

	// attachOnce gates a single live console pump per Server. The pump
	// streams Docker stdout/stderr into the bus + history.
	attachMu     sync.Mutex
	attachCancel context.CancelFunc

	// statsCancel + uptime tracking for the WS stats event.
	statsMu     sync.Mutex
	statsCancel context.CancelFunc
	startedAt   time.Time

	// errorOnce gates one-shot daemon error events (eula-required, …).
	// Reset on each start so a subsequent run can re-emit. Prevents
	// every console line that contains "eula" from spamming the bus.
	errorMu      sync.Mutex
	errorEmitted map[string]bool
}

// Config is the operating data the daemon needs to actually run a
// container. Sent by the API at start time as the `set state start`
// payload (envelope arg) or as a separate REST configuration push.
type Config struct {
	DockerImage    string
	StartupCommand string
	Environment    map[string]string
	Stop           environment.StopConfig
	Memory         int64
	CPUPercent     int64
	PortMappings   []docker.PortMapping
	BindMount      string
}

// New constructs a Server for the supplied uuid. Container name follows
// the "stellar-<uuid>" convention so reconcile can find it.
func New(uuid string, dc *docker.Client, panelClient *panel.Client, historyLines int) *Server {
	containerName := "stellar-" + uuid
	env := environment.New(dc, containerName)
	bus := events.New()
	hist := newConsoleHistory(historyLines)
	s := &Server{
		uuid:      uuid,
		env:       env,
		bus:       bus,
		history:   hist,
		panel:     panelClient,
		powerLock: make(chan struct{}, 1),
	}
	env.SetListener(s.onStateChange)
	return s
}

func (s *Server) UUID() string                       { return s.uuid }
func (s *Server) Environment() *environment.Environment { return s.env }
func (s *Server) Bus() *events.Bus                   { return s.bus }
func (s *Server) History() *consoleHistory           { return s.history }
func (s *Server) Panel() *panel.Client               { return s.panel }

// SetConfig replaces the operating data. Threadsafe; in-flight power
// actions read the previous snapshot, the next read sees the update.
func (s *Server) SetConfig(c Config) {
	s.cfgMu.Lock()
	s.cfg = c
	s.cfgMu.Unlock()
	s.env.SetStop(c.Stop)
}

func (s *Server) Config() Config {
	s.cfgMu.RLock()
	defer s.cfgMu.RUnlock()
	return s.cfg
}

// PublishDaemon is the exported sibling of publishDaemon for callers
// outside the server package (router/backups.go etc) that want to push
// daemon-prefixed status messages into the same console stream.
func (s *Server) PublishDaemon(msg string) { s.publishDaemon(msg) }

// publishDaemon emits a Pelican-style "[StellarStack Daemon]: <msg>"
// console line so the panel surfaces what the daemon is doing during a
// power action — pulling images, running config patches, marking
// state, etc. Output goes through the same bus + history pipeline as
// real container stdout so the user sees a continuous stream.
func (s *Server) publishDaemon(msg string) {
	line := "[StellarStack Daemon]: " + msg
	s.history.push(line)
	frame, _ := json.Marshal(map[string]any{
		"event": "console output",
		"args":  []any{line},
	})
	s.bus.Publish(frame)
}

// publishDaemonError emits a one-shot `{event:"daemon error", args:[code]}`
// frame over the bus so the panel can react with a structured response
// (e.g. show the EULA modal). The same code is only emitted once per
// run; resetErrors() in doStart wipes the gate so a fresh attempt can
// re-emit on a still-broken state.
func (s *Server) publishDaemonError(code string) {
	s.errorMu.Lock()
	if s.errorEmitted == nil {
		s.errorEmitted = map[string]bool{}
	}
	if s.errorEmitted[code] {
		s.errorMu.Unlock()
		return
	}
	s.errorEmitted[code] = true
	s.errorMu.Unlock()
	frame, _ := json.Marshal(map[string]any{
		"event": "daemon error",
		"args":  []any{code},
	})
	s.bus.Publish(frame)
}

// resetErrors clears the per-run daemon-error gate. Called at the start
// of every power-on so a previous run's eula-required (or whatever)
// doesn't suppress this run's emission.
func (s *Server) resetErrors() {
	s.errorMu.Lock()
	s.errorEmitted = nil
	s.errorMu.Unlock()
}

// eulaPattern catches the canonical Minecraft "you need to agree to the
// EULA" line. Lower-case match on the cleaned console text — vanilla
// emits `[]: You need to agree to the EULA in order to run the server.
// Go to eula.txt for more info.` Various third-party JARs reword it
// slightly so we match the stable substring rather than the full line.
var eulaPattern = regexp.MustCompile(`(?i)you need to agree to the eula`)

// scanLineForErrors looks at one cleaned console line and emits a
// daemon error if it matches a known failure pattern. Cheap; called
// from the attach pump for every line.
func (s *Server) scanLineForErrors(line string) {
	if eulaPattern.MatchString(line) {
		s.publishDaemon("Server failed to start because the EULA has not been accepted. Accept it from the panel to continue.")
		s.publishDaemonError("eula-required")
	}
}

// publishHeader emits a "stellarstack@<uuid>~ <msg>" prompt-style line.
// Used to announce state transitions in-band so the console reads as a
// natural session log, mirroring Pelican's `pelican@<name>~ Server
// marked as ...` format.
func (s *Server) publishHeader(msg string) {
	line := "stellarstack@" + s.uuid[:8] + "~ " + msg
	s.history.push(line)
	frame, _ := json.Marshal(map[string]any{
		"event": "console output",
		"args":  []any{line},
	})
	s.bus.Publish(frame)
}

// onStateChange is invoked by the Environment listener for every state
// transition. We broadcast over the bus AND POST a callback to the API.
func (s *Server) onStateChange(prev, next environment.State) {
	// Stack hint shows which call path triggered the transition; helps
	// debug surprise offline transitions caused by a stale watchExit
	// or a cancelled pump's deferred cleanup.
	pc, _, _, _ := runtime.Caller(2)
	caller := runtime.FuncForPC(pc).Name()
	log.Printf("server %s: state %s -> %s (caller=%s)", s.uuid, prev, next, caller)
	s.publishHeader("Server marked as " + string(next) + "...")
	frame, _ := json.Marshal(map[string]any{
		"event": "status",
		"args":  []any{string(next)},
	})
	s.bus.Publish(frame)

	if s.panel != nil {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			err := s.panel.PushStatus(ctx, s.uuid, string(prev), string(next))
			if err != nil {
				log.Printf("server %s: push status: %v", s.uuid, err)
			}
		}()
	}

	switch next {
	case environment.StateRunning:
		s.startAttachPump()
		s.startStatsPump()
	case environment.StateOffline:
		s.stopAttachPump()
		s.stopStatsPump()
		// Clear the history ring so a future browser (re)connect on an
		// offline server doesn't dump the previous session's log. The
		// frontend's offline-transition path also clears its in-memory
		// buffer; this is the daemon-side counterpart for fresh tabs.
		s.history.Reset()
	}
}

// PowerAction is the union of operations the WS exposes.
type PowerAction string

const (
	PowerStart   PowerAction = "start"
	PowerStop    PowerAction = "stop"
	PowerRestart PowerAction = "restart"
	PowerKill    PowerAction = "kill"
)

// HandlePower runs the supplied action under the per-server power lock.
// kill bypasses the wait (try-acquire); the others block until they can
// acquire it. Returns once the action is dispatched (start) or complete
// (stop/restart/kill).
func (s *Server) HandlePower(ctx context.Context, action PowerAction) error {
	if action == PowerKill {
		select {
		case s.powerLock <- struct{}{}:
			defer func() { <-s.powerLock }()
		default:
			// Lock held by another action; kill anyway via direct SIGKILL,
			// don't wait. Mirrors Pelican's "kill bypasses lock" path.
			return s.doKill(ctx)
		}
		return s.doKill(ctx)
	}

	select {
	case s.powerLock <- struct{}{}:
		defer func() { <-s.powerLock }()
	case <-ctx.Done():
		return ctx.Err()
	}

	switch action {
	case PowerStart:
		return s.doStart(ctx)
	case PowerStop:
		return s.doStop(ctx)
	case PowerRestart:
		return s.doRestart(ctx)
	default:
		return fmt.Errorf("unknown power action %q", action)
	}
}

// doStart creates the container if missing and starts it. Idempotent
// against a stopped container: removes the old, creates fresh, starts.
func (s *Server) doStart(ctx context.Context) error {
	if s.env.State() == environment.StateRunning {
		return errors.New("already running")
	}
	cfg := s.Config()
	if cfg.DockerImage == "" {
		return errors.New("server has no docker image configured (start payload missing)")
	}

	s.resetErrors()
	s.env.MarkStarting()
	s.publishDaemon("Updating process configuration files...")

	containerName := s.env.ContainerName()
	dc := s.env.Docker()

	// Force-remove any existing container first so old state cannot
	// leak. RemoveContainer is a no-op when the container is missing.
	if err := dc.RemoveContainer(ctx, containerName, true); err != nil {
		log.Printf("server %s: pre-start remove: %v", s.uuid, err)
	}

	s.publishDaemon("Pulling Docker container image, this could take a few minutes to complete...")
	if err := dc.EnsureImage(ctx, cfg.DockerImage); err != nil {
		s.publishDaemon("Failed to pull Docker container image: " + err.Error())
		s.env.MarkOffline()
		return fmt.Errorf("ensure image: %w", err)
	}
	s.publishDaemon("Finished pulling Docker container image")

	stopSignal := ""
	if cfg.Stop.Type == "signal" {
		stopSignal = cfg.Stop.Value
	}
	if _, err := dc.CreateContainer(ctx, docker.CreateContainerOptions{
		Name:             containerName,
		Image:            cfg.DockerImage,
		Env:              flattenEnv(cfg.Environment, cfg.StartupCommand, cfg.Memory),
		StopSignal:       stopSignal,
		BindMount:        cfg.BindMount,
		MemoryLimitBytes: cfg.Memory * 1024 * 1024,
		CPULimitPercent:  cfg.CPUPercent,
		PidsLimit:        256,
		Ports:            cfg.PortMappings,
		OpenStdin:        true,
		Tty:              true,
	}); err != nil {
		s.publishDaemon("Failed to create container: " + err.Error())
		s.env.MarkOffline()
		return fmt.Errorf("create container: %w", err)
	}

	// Pelican-shape: open the docker attach stream BEFORE starting the
	// container so we capture every byte of stdout/stderr from the
	// moment the entrypoint runs. The /logs?follow=1 path loses output
	// between StartContainer and the first follow read.
	attachConn, attachReader, attachErr := dc.Attach(context.Background(), containerName, docker.AttachOptions{
		Stdin:  true,
		Stdout: true,
		Stderr: true,
		Stream: true,
	})
	if attachErr != nil {
		s.publishDaemon("Failed to attach to container: " + attachErr.Error())
		s.env.MarkOffline()
		return fmt.Errorf("pre-start attach: %w", attachErr)
	}
	tty := false
	if t, err := dc.InspectConfigTTY(ctx, containerName); err == nil {
		tty = t
	}
	s.startAttachStream(attachReader, tty, func() { _ = attachConn.Close() })

	if err := dc.StartContainer(ctx, containerName); err != nil {
		_ = attachConn.Close()
		s.env.MarkOffline()
		return fmt.Errorf("start container: %w", err)
	}

	// Capture started-at for uptime in stats frames. We don't fail the
	// start if inspect fails; the field is optional in the wire schema.
	if st, err := dc.Inspect(context.Background(), containerName); err == nil && st != nil {
		if t, err := time.Parse(time.RFC3339Nano, st.StartedAt); err == nil {
			s.statsMu.Lock()
			s.startedAt = t
			s.statsMu.Unlock()
		}
	}

	// Pelican-shape: flip to running the moment Docker reports the
	// container is up. ForceState (vs MarkRunning) emits even when the
	// previous cached state already happened to be running — covers
	// reconcile-then-restart where the env's prev state matched the
	// new state and the listener would otherwise no-op.
	s.env.ForceState(environment.StateRunning)
	log.Printf("server %s: state -> running (container started)", s.uuid)

	// Watch for unexpected exit. When this fires while the watcher
	// hasn't been replaced (i.e. nobody pressed stop), flip to offline.
	go s.watchExit()
	return nil
}

func (s *Server) doStop(ctx context.Context) error {
	if s.env.State() == environment.StateOffline {
		return nil
	}
	return s.env.WaitForStop(ctx, 30*time.Second, true)
}

func (s *Server) doRestart(ctx context.Context) error {
	if s.env.State() != environment.StateOffline {
		if err := s.env.WaitForStop(ctx, 30*time.Second, true); err != nil {
			return fmt.Errorf("restart-stop: %w", err)
		}
	}
	return s.doStart(ctx)
}

func (s *Server) doKill(ctx context.Context) error {
	if err := s.env.Terminate(ctx, "SIGKILL"); err != nil {
		return err
	}
	final, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = s.env.Docker().WaitNotRunning(final, s.env.ContainerName())
	s.env.MarkOffline()
	return nil
}

// watchExit blocks on Docker container wait. Used to detect a container
// that exited without anyone asking it to (crash) so the UI flips off.
func (s *Server) watchExit() {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	// next-exit fires only on the NEXT exit, not on the current state.
	// Using condition=not-running here would race against the brief
	// `created` window after StartContainer and flip a healthy
	// container to offline immediately.
	exited := s.env.Docker().WaitNextExit(ctx, s.env.ContainerName())
	if !exited {
		return
	}
	// If state is already stopping/offline, the stop path will set it.
	// We only intervene when we're in running.
	if s.env.State() != environment.StateRunning {
		return
	}
	// Inspect to learn how the container exited so we can emit a
	// meaningful audit reason on the way to offline. OOM, non-zero exit,
	// and clean exit each get their own metadata code.
	st, _ := s.env.Docker().Inspect(context.Background(), s.env.ContainerName())
	reason := "servers.lifecycle.exited.clean"
	metadata := map[string]any{}
	if st != nil {
		metadata["exitCode"] = st.ExitCode
		switch {
		case st.OOMKilled:
			reason = "servers.lifecycle.crashed.oom_killed"
		case st.ExitCode != 0:
			reason = "servers.lifecycle.crashed.container_exit"
		}
	}
	if s.panel != nil {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			_ = s.panel.PushAudit(ctx, s.uuid, "", reason, metadata)
		}()
	}
	// Drain the docker log buffer one last time so a fast-exit
	// container (e.g. JVM version mismatch that dies in <1s before
	// the streaming pump's first read returns) still leaves its
	// failure reason in the panel console + history.
	drainCtx, drainCancel := context.WithTimeout(context.Background(), 5*time.Second)
	s.SnapshotLogs(drainCtx, 200)
	drainCancel()
	s.env.MarkOffline()
}

// flattenEnv converts a map of environment variables into Docker's
// expected slice form, injecting STARTUP and SERVER_MEMORY (Pelican-
// compatible names so blueprints don't need a translation layer).
func flattenEnv(env map[string]string, startup string, memoryMb int64) map[string]string {
	out := make(map[string]string, len(env)+2)
	for k, v := range env {
		out[k] = v
	}
	if startup != "" {
		out["STARTUP"] = startup
	}
	if memoryMb > 0 {
		out["SERVER_MEMORY"] = fmt.Sprintf("%d", memoryMb)
	}
	return out
}

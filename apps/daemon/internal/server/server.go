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

// onStateChange is invoked by the Environment listener for every state
// transition. We broadcast over the bus AND POST a callback to the API.
func (s *Server) onStateChange(prev, next environment.State) {
	log.Printf("server %s: state %s -> %s", s.uuid, prev, next)
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

	s.env.MarkStarting()

	containerName := s.env.ContainerName()
	dc := s.env.Docker()

	// Force-remove any existing container first so old state cannot
	// leak. RemoveContainer is a no-op when the container is missing.
	if err := dc.RemoveContainer(ctx, containerName, true); err != nil {
		log.Printf("server %s: pre-start remove: %v", s.uuid, err)
	}

	if err := dc.EnsureImage(ctx, cfg.DockerImage); err != nil {
		s.env.MarkOffline()
		return fmt.Errorf("ensure image: %w", err)
	}

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
		s.env.MarkOffline()
		return fmt.Errorf("create container: %w", err)
	}

	if err := dc.StartContainer(ctx, containerName); err != nil {
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
	exited := s.env.Docker().WaitNotRunning(ctx, s.env.ContainerName())
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

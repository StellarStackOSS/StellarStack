// Package handler dispatches inbound worker→daemon WS frames to the right
// docker / lifecycle code path and produces the matching response envelope.
package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/stellarstack/daemon/internal/config"
	"github.com/stellarstack/daemon/internal/configpatch"
	"github.com/stellarstack/daemon/internal/docker"
	"github.com/stellarstack/daemon/internal/files"
	"github.com/stellarstack/daemon/internal/lifecycle"
	"github.com/stellarstack/daemon/internal/s3"
	"github.com/stellarstack/daemon/internal/transfer"
)

// Sender is anything that can emit a JSON-encoded envelope back to the API
// over the daemon's WebSocket. The ws package implements this against the
// live socket; tests can stand it in with an in-memory recorder.
type Sender interface {
	Send(ctx context.Context, payload []byte) error
}

// indirectSender wraps a replaceable Sender so background goroutines
// (lifecycle probes, stats streams) always write to the current WS
// connection rather than the one that was live when they were launched.
type indirectSender struct {
	mu     sync.RWMutex
	sender Sender
}

func (s *indirectSender) Send(ctx context.Context, payload []byte) error {
	s.mu.RLock()
	cur := s.sender
	s.mu.RUnlock()
	if cur == nil {
		return nil
	}
	return cur.Send(ctx, payload)
}

func (s *indirectSender) set(sender Sender) {
	s.mu.Lock()
	s.sender = sender
	s.mu.Unlock()
}

// Handler routes inbound messages to docker calls. Per-server state (the
// lifecycle.Watcher and its blueprint lifecycle config) is held in
// `watchers` so power-action and lifecycle-transition handling can find
// the existing state machine.
type Handler struct {
	cfg      *config.Config
	docker   *docker.Client
	files    *files.Manager
	Transfer *transfer.Registry

	bgSend *indirectSender // shared by all watchers/stats goroutines; updated on reconnect

	mu       sync.Mutex
	watchers map[string]*serverState

	powerLocksMu sync.Mutex
	powerLocks   map[string]*sync.Mutex
}

type serverState struct {
	containerName string
	watcher       *lifecycle.Watcher
	lifecycle     lifecycle.Lifecycle
	stopSignal    string // raw stop signal from blueprint; "^cmd" means write cmd to stdin
	statsCancel   context.CancelFunc
}

// New returns a Handler bound to the local Docker socket.
func New(cfg *config.Config) *Handler {
	return &Handler{
		cfg:      cfg,
		docker:   docker.New(cfg.ResolvedDockerSocket()),
		files:    files.New(cfg.DataDir),
		Transfer: transfer.NewRegistry(),
		bgSend:   &indirectSender{},
		watchers: map[string]*serverState{},
	}
}

// SetSender replaces the shared background sender used by all lifecycle
// watchers and stats goroutines. Called by the ws package on every new
// connection so in-flight goroutines write to the live socket.
func (h *Handler) SetSender(s Sender) {
	h.bgSend.set(s)
}

// runSyncStop performs the configured stop sequence and blocks until the
// container has exited (or has been force-killed after the grace timeout).
// `signal` may be empty (defer to Docker's container-level stop signal),
// "^cmd" (write `cmd` to the container's stdin), or a signal name like
// "SIGTERM". Mirrors Wings' Environment.WaitForStop.
func (h *Handler) runSyncStop(containerName, signal string, graceSeconds int) error {
	if graceSeconds <= 0 {
		graceSeconds = 30
	}

	if strings.HasPrefix(signal, "^") {
		cmd := strings.TrimPrefix(signal, "^")
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		conn, _, connErr := h.docker.AttachConn(ctx, containerName)
		cancel()
		if connErr == nil {
			_, _ = io.WriteString(conn, cmd+"\n")
			conn.Close()
		} else {
			log.Printf("daemon: stop attach: %v", connErr)
		}

		waitCtx, waitCancel := context.WithTimeout(context.Background(), time.Duration(graceSeconds)*time.Second)
		defer waitCancel()
		exited := h.docker.WaitForExit(waitCtx, containerName, 0)
		if !exited {
			killCtx, killCancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer killCancel()
			if err := h.docker.KillContainer(killCtx, containerName); err != nil {
				return fmt.Errorf("force kill after grace: %w", err)
			}
			finalCtx, finalCancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer finalCancel()
			h.docker.WaitForExit(finalCtx, containerName, 0)
		}
		return nil
	}

	// Signal-based stop (or empty signal — Docker uses the container's
	// configured StopSignal in that case). StopContainer issues the signal
	// and waits up to graceSeconds before SIGKILL'ing.
	stopCtx, cancel := context.WithTimeout(context.Background(), time.Duration(graceSeconds+10)*time.Second)
	defer cancel()
	if err := h.docker.StopContainer(stopCtx, containerName, graceSeconds); err != nil {
		// Docker's stop call itself failed — fall through to a kill so we
		// still converge on a stopped container.
		log.Printf("daemon: stop container: %v", err)
		killCtx, killCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer killCancel()
		if killErr := h.docker.KillContainer(killCtx, containerName); killErr != nil {
			return fmt.Errorf("kill after stop failure: %w", killErr)
		}
	}
	finalCtx, finalCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer finalCancel()
	h.docker.WaitForExit(finalCtx, containerName, 0)
	return nil
}

func (h *Handler) powerLock(serverID string) *sync.Mutex {
	h.powerLocksMu.Lock()
	defer h.powerLocksMu.Unlock()
	if h.powerLocks == nil {
		h.powerLocks = map[string]*sync.Mutex{}
	}
	if h.powerLocks[serverID] == nil {
		h.powerLocks[serverID] = &sync.Mutex{}
	}
	return h.powerLocks[serverID]
}

// dirSize returns the total byte size of all regular files under root.
// Symlinks are not followed. Returns 0 on any error.
func dirSize(root string) int64 {
	var total int64
	_ = filepath.Walk(root, func(_ string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}
		total += info.Size()
		return nil
	})
	return total
}

// startStats launches a goroutine that streams Docker container stats and
// emits server.stats frames via the shared bgSend. Any previously running
// stats goroutine for the same server is cancelled first. This is the
// single producer of server.stats frames; lifecycle.Watcher does not run
// its own stream so we don't double-emit.
func (h *Handler) startStats(ctx context.Context, state *serverState) {
	if state.statsCancel != nil {
		state.statsCancel()
	}
	sctx, cancel := context.WithCancel(ctx)
	state.statsCancel = cancel
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("daemon: stats stream panic: %v", r)
			}
		}()
		serverID := strings.TrimPrefix(state.containerName, "stellar-")
		serverDir := filepath.Join(h.cfg.DataDir, "servers", serverID)

		// Capture container start time once so the frontend can compute uptime.
		var startedAt string
		if inspect, err := h.docker.InspectState(sctx, state.containerName); err == nil && inspect != nil {
			startedAt = inspect.StartedAt
		}

		// Calculate disk usage once upfront, then refresh every 60 seconds.
		// Walking the directory on every Docker stats frame (every ~1 s) would
		// be too expensive for large server directories.
		var diskBytes int64
		diskBytes = dirSize(serverDir)
		diskTicker := time.NewTicker(60 * time.Second)
		defer diskTicker.Stop()

		ch, err := h.docker.StatsStream(sctx, state.containerName)
		if err != nil {
			log.Printf("daemon: stats stream: %v", err)
			return
		}
		for {
			select {
			case <-sctx.Done():
				return
			case snap, ok := <-ch:
				if !ok {
					return
				}
				frame := map[string]any{
					"type":             "server.stats",
					"serverId":         serverID,
					"memoryBytes":      snap.MemoryBytes,
					"memoryLimitBytes": snap.MemoryLimitBytes,
					"cpuFraction":      snap.CPUFraction,
					"diskBytes":        diskBytes,
					"networkRxBytes":   snap.NetworkRxBytes,
					"networkTxBytes":   snap.NetworkTxBytes,
					"diskReadBytes":    snap.DiskReadBytes,
					"diskWriteBytes":   snap.DiskWriteBytes,
					"at":               time.Now().UTC().Format(time.RFC3339Nano),
				}
				if startedAt != "" {
					frame["startedAt"] = startedAt
				}
				_ = writeEnvelope(sctx, h.bgSend, "", frame)
			case <-diskTicker.C:
				diskBytes = dirSize(serverDir)
			}
		}
	}()
}

// stopStats cancels the running stats goroutine for a server, if any.
func stopStats(state *serverState) {
	if state.statsCancel != nil {
		state.statsCancel()
		state.statsCancel = nil
	}
}

// Resume is kept for callers that were already using it; it delegates to Reconcile.
func (h *Handler) Resume(ctx context.Context) {
	h.Reconcile(ctx)
}

// Reconcile scans all stellar-* Docker containers on connect/reconnect and
// emits server.state.changed frames so the DB and panel reflect the actual
// container state. Running containers also get stats streaming re-armed.
// This corrects drift that accumulates when the daemon crashes while
// containers keep running (or stop unexpectedly).
func (h *Handler) Reconcile(ctx context.Context) {
	containers, err := h.docker.ListContainers(ctx, "stellar-")
	if err != nil {
		log.Printf("daemon: reconcile scan: %v", err)
		return
	}

	type work struct {
		state   *serverState
		running bool
	}
	var jobs []work

	h.mu.Lock()
	for _, c := range containers {
		if strings.HasPrefix(c.Name, "stellar-install-") {
			continue
		}
		serverID := strings.TrimPrefix(c.Name, "stellar-")
		existing := h.watchers[serverID]
		if existing == nil {
			w := lifecycle.New(serverID, c.Name, h.docker, h.bgSend)
			existing = &serverState{
				containerName: c.Name,
				watcher:       w,
				lifecycle:     lifecycle.Lifecycle{},
			}
			h.watchers[serverID] = existing
		}
		jobs = append(jobs, work{state: existing, running: c.Running})
	}
	h.mu.Unlock()

	for _, j := range jobs {
		serverID := strings.TrimPrefix(j.state.containerName, "stellar-")
		current := j.state.watcher.State()
		if current == lifecycle.StateStopping || current == lifecycle.StateStarting {
			// Already in a managed transition; reconcile must not clobber it.
			continue
		}
		if j.running {
			log.Printf("daemon: reconcile running server=%s", serverID)
			// Always force-emit so the DB and panel pick up the real state
			// after a daemon restart, even when the fresh watcher's default
			// state already matches Docker. The event is also what the
			// frontend uses to drop pending optimistic UI state.
			j.state.watcher.ForceEmit(lifecycle.StateRunning, "servers.lifecycle.reconcile.running")
			go h.startStats(ctx, j.state)
		} else {
			log.Printf("daemon: reconcile stopped server=%s", serverID)
			j.state.watcher.ForceEmit(lifecycle.StateStopped, "servers.lifecycle.reconcile.stopped")
		}
	}
}

// HandleEnvelope inspects the message type and dispatches.
func (h *Handler) HandleEnvelope(
	ctx context.Context,
	raw []byte,
	send Sender,
) error {
	var envelope struct {
		ID      string          `json:"id"`
		Message json.RawMessage `json:"message"`
	}
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return fmt.Errorf("decode envelope: %w", err)
	}
	if len(envelope.Message) == 0 {
		return nil
	}
	var typed struct {
		Type string `json:"type"`
	}
	if err := json.Unmarshal(envelope.Message, &typed); err != nil {
		return fmt.Errorf("decode type: %w", err)
	}

	switch typed.Type {
	case "server.create_container":
		return h.handleCreateContainer(ctx, envelope.ID, envelope.Message, send)
	case "server.run_install":
		return h.handleRunInstall(ctx, envelope.ID, envelope.Message, send)
	case "server.start":
		return h.handlePower(ctx, envelope.ID, envelope.Message, send, "start")
	case "server.stop":
		return h.handlePower(ctx, envelope.ID, envelope.Message, send, "stop")
	case "server.kill":
		return h.handlePower(ctx, envelope.ID, envelope.Message, send, "kill")
	case "server.delete":
		return h.handleDelete(ctx, envelope.ID, envelope.Message, send)
	case "server.create_backup":
		return h.handleCreateBackup(ctx, envelope.ID, envelope.Message, send)
	case "server.restore_backup":
		return h.handleRestoreBackup(ctx, envelope.ID, envelope.Message, send)
	case "server.delete_backup":
		return h.handleDeleteBackup(ctx, envelope.ID, envelope.Message, send)
	case "server.upload_backup_s3":
		return h.handleUploadBackupS3(ctx, envelope.ID, envelope.Message, send)
	case "server.send_console":
		return h.handleSendConsole(ctx, envelope.ID, envelope.Message, send)
	case "server.prepare_transfer":
		return h.handlePrepareTransfer(ctx, envelope.ID, envelope.Message, send)
	case "server.push_transfer":
		return h.handlePushTransfer(ctx, envelope.ID, envelope.Message, send)
	default:
		log.Printf("daemon: ignoring message type %q", typed.Type)
		return writeEnvelope(ctx, send, envelope.ID, map[string]any{
			"type": "ack",
		})
	}
}

func (h *Handler) handleCreateContainer(
	ctx context.Context,
	id string,
	raw json.RawMessage,
	send Sender,
) error {
	var msg struct {
		Type            string            `json:"type"`
		ServerID        string            `json:"serverId"`
		DockerImage     string            `json:"dockerImage"`
		MemoryLimitMb   int64             `json:"memoryLimitMb"`
		CPULimitPercent int64             `json:"cpuLimitPercent"`
		ProcessLimit    int64             `json:"processLimit"`
		Environment     map[string]string `json:"environment"`
		PortMappings    []struct {
			IP            string `json:"ip"`
			Port          int    `json:"port"`
			ContainerPort int    `json:"containerPort"`
		} `json:"portMappings"`
		StartupCommand string                 `json:"startupCommand"`
		StopSignal     string                 `json:"stopSignal"`
		Lifecycle      lifecycle.Lifecycle    `json:"lifecycle"`
		Features       map[string][]string    `json:"features"`
		ConfigFiles    []configpatch.Spec     `json:"configFiles"`
	}
	if err := json.Unmarshal(raw, &msg); err != nil {
		return writeError(ctx, send, id, "internal.unexpected", nil)
	}

	bindMount := filepath.Join(h.cfg.DataDir, "servers", msg.ServerID)
	if err := os.MkdirAll(bindMount, 0o777); err != nil {
		log.Printf("daemon: bind-mount mkdir failed: %v", err)
		return writeError(ctx, send, id, "internal.unexpected", nil)
	}

	if err := h.docker.EnsureImage(ctx, msg.DockerImage); err != nil {
		log.Printf("daemon: ensure image: %v", err)
		return writeError(ctx, send, id, "internal.unexpected", nil)
	}

	ports := map[string]string{}
	for _, mapping := range msg.PortMappings {
		ports[fmt.Sprintf("%d/tcp", mapping.ContainerPort)] = fmt.Sprintf("%d", mapping.Port)
	}

	containerName := "stellar-" + msg.ServerID
	_ = h.docker.RemoveContainer(ctx, containerName, true)

	// Inject the resolved startup command as STARTUP so the image's entrypoint
	// script (e.g. yolks entrypoint.sh) picks it up — mirrors Pelican Wings'
	// GetEnvironmentVariables() which puts the invocation in $STARTUP rather
	// than overriding Docker's Cmd slot.
	env := make(map[string]string, len(msg.Environment)+1)
	for k, v := range msg.Environment {
		env[k] = v
	}
	env["STARTUP"] = configpatch.SubstituteVars(msg.StartupCommand, msg.Environment)

	createCtx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()
	_, err := h.docker.CreateContainer(createCtx, docker.CreateContainerOptions{
		Name:             containerName,
		Image:            msg.DockerImage,
		Env:              env,
		StopSignal:       dockerStopSignal(msg.StopSignal),
		BindMount:        bindMount,
		MemoryLimitBytes: msg.MemoryLimitMb * 1024 * 1024,
		CPULimitPercent:  msg.CPULimitPercent,
		PidsLimit:        msg.ProcessLimit,
		Ports:            ports,
	})
	if err != nil {
		log.Printf("daemon: create container: %v", err)
		return writeError(ctx, send, id, "internal.unexpected", nil)
	}

	h.mu.Lock()
	h.watchers[msg.ServerID] = &serverState{
		containerName: containerName,
		watcher:       lifecycle.New(msg.ServerID, containerName, h.docker, h.bgSend),
		lifecycle:     msg.Lifecycle,
		stopSignal:    msg.StopSignal,
	}
	h.mu.Unlock()

	return writeEnvelope(ctx, send, id, map[string]any{"type": "ack"})
}

func (h *Handler) handleRunInstall(
	ctx context.Context,
	id string,
	raw json.RawMessage,
	send Sender,
) error {
	var msg struct {
		Type     string `json:"type"`
		ServerID string `json:"serverId"`
		Install  struct {
			Image      string `json:"image"`
			Entrypoint string `json:"entrypoint"`
			Script     string `json:"script"`
		} `json:"install"`
		Environment map[string]string `json:"environment"`
	}
	if err := json.Unmarshal(raw, &msg); err != nil {
		return writeError(ctx, send, id, "internal.unexpected", nil)
	}

	bindMount := filepath.Join(h.cfg.DataDir, "servers", msg.ServerID)
	if err := os.MkdirAll(bindMount, 0o755); err != nil {
		return writeError(ctx, send, id, "internal.unexpected", nil)
	}

	if err := h.docker.EnsureImage(ctx, msg.Install.Image); err != nil {
		log.Printf("daemon: ensure install image: %v", err)
		return writeError(ctx, send, id, "internal.unexpected", nil)
	}

	logs, exit, errs := h.docker.RunInstall(ctx, docker.RunInstallOptions{
		Name:       "stellar-install-" + msg.ServerID,
		Image:      msg.Install.Image,
		Entrypoint: msg.Install.Entrypoint,
		Script:     msg.Install.Script,
		Env:        msg.Environment,
		ServerDir:  bindMount,
		TmpDir:     filepath.Join(h.cfg.DataDir, "tmp"),
	})

	for {
		select {
		case <-ctx.Done():
			return writeError(ctx, send, id, "internal.unexpected", nil)
		case line, ok := <-logs:
			if !ok {
				logs = nil
				continue
			}
			_ = writeEnvelope(ctx, send, id, map[string]any{
				"type":     "server.install_log",
				"serverId": msg.ServerID,
				"stream":   line.Stream,
				"line":     line.Line,
				"at":       time.Now().UTC().Format(time.RFC3339Nano),
			})
		case code := <-exit:
			if code != 0 {
				return writeError(ctx, send, id, "internal.unexpected", map[string]any{
					"exitCode": code,
				})
			}
			return writeEnvelope(ctx, send, id, map[string]any{"type": "ack"})
		case err := <-errs:
			if err != nil {
				log.Printf("daemon: run install: %v", err)
				return writeError(ctx, send, id, "internal.unexpected", nil)
			}
		}
	}
}

func (h *Handler) handlePower(
	ctx context.Context,
	id string,
	raw json.RawMessage,
	send Sender,
	action string,
) error {
	var msg struct {
		ServerID   string `json:"serverId"`
		StopSignal string `json:"stopSignal"`
		Container  *struct {
			DockerImage     string            `json:"dockerImage"`
			MemoryLimitMb   int64             `json:"memoryLimitMb"`
			CPULimitPercent int64             `json:"cpuLimitPercent"`
			ProcessLimit    int64             `json:"processLimit"`
			Environment     map[string]string `json:"environment"`
			PortMappings    []struct {
				IP            string `json:"ip"`
				Port          int    `json:"port"`
				ContainerPort int    `json:"containerPort"`
			} `json:"portMappings"`
			StartupCommand string                 `json:"startupCommand"`
			StopSignal     string                 `json:"stopSignal"`
			Lifecycle      lifecycle.Lifecycle    `json:"lifecycle"`
			Features       map[string][]string    `json:"features"`
			ConfigFiles    []configpatch.Spec     `json:"configFiles"`
		} `json:"container"`
	}
	if err := json.Unmarshal(raw, &msg); err != nil {
		return writeError(ctx, send, id, "internal.unexpected", nil)
	}

	log.Printf("daemon: power action=%s server=%s", action, msg.ServerID)

	lock := h.powerLock(msg.ServerID)
	lock.Lock()
	defer lock.Unlock()
	log.Printf("daemon: power lock acquired action=%s server=%s", action, msg.ServerID)

	h.mu.Lock()
	state := h.watchers[msg.ServerID]
	h.mu.Unlock()
	containerName := "stellar-" + msg.ServerID
	if state != nil {
		containerName = state.containerName
	}

	// Ensure a watcher exists for servers that weren't installed in this
	// daemon session (e.g. after a daemon restart). Without one, no
	// state-change events are emitted to the panel.
	if state == nil {
		w := lifecycle.New(msg.ServerID, containerName, h.docker, h.bgSend)
		state = &serverState{
			containerName: containerName,
			watcher:       w,
			lifecycle:     lifecycle.Lifecycle{},
		}
		h.mu.Lock()
		h.watchers[msg.ServerID] = state
		h.mu.Unlock()
	}

	switch action {
	case "start":
		if msg.Container == nil {
			return writeError(ctx, send, id, "internal.unexpected", nil)
		}
		c := msg.Container
		bindMount := filepath.Join(h.cfg.DataDir, "servers", msg.ServerID)

		// Persist lifecycle + stop signal before any async work so the watcher
		// is up to date if a stop arrives while we're still setting up.
		state.lifecycle = c.Lifecycle
		state.stopSignal = c.StopSignal
		h.mu.Lock()
		h.watchers[msg.ServerID] = state
		h.mu.Unlock()

		// Emit starting immediately so the panel responds without waiting for
		// EnsureImage + CreateContainer (which can take several seconds).
		state.watcher.SetState(ctx, lifecycle.StateStarting, "servers.lifecycle.starting.requested")

		if mkErr := os.MkdirAll(bindMount, 0o755); mkErr != nil {
			log.Printf("daemon: start mkdir: %v", mkErr)
			state.watcher.SetState(ctx, lifecycle.StateCrashed, "servers.lifecycle.start_failed")
			return writeError(ctx, send, id, "internal.unexpected", nil)
		}

		if len(c.ConfigFiles) > 0 {
			configpatch.Apply(bindMount, c.ConfigFiles, c.Environment)
		}

		// Wait up to 15 seconds for the old container to exit gracefully before
		// force-removing it. This lets shutdown logs stream to the console during
		// restart and ensures ^stop completes before the new container starts.
		h.docker.WaitForExit(ctx, containerName, 15*time.Second)
		log.Printf("daemon: removing old container %s", containerName)
		_ = h.docker.RemoveContainer(ctx, containerName, true)

		log.Printf("daemon: ensuring image %s", c.DockerImage)
		if imgErr := h.docker.EnsureImage(ctx, c.DockerImage); imgErr != nil {
			log.Printf("daemon: ensure image on start: %v", imgErr)
			state.watcher.SetState(ctx, lifecycle.StateCrashed, "servers.lifecycle.start_failed")
			return writeError(ctx, send, id, "internal.unexpected", nil)
		}
		log.Printf("daemon: image ready")

		ports := map[string]string{}
		for _, pm := range c.PortMappings {
			ports[fmt.Sprintf("%d/tcp", pm.ContainerPort)] = fmt.Sprintf("%d", pm.Port)
		}

		env := make(map[string]string, len(c.Environment)+1)
		for k, v := range c.Environment {
			env[k] = v
		}
		resolvedCmd := configpatch.SubstituteVars(c.StartupCommand, c.Environment)
		env["STARTUP"] = resolvedCmd
		log.Printf("daemon: creating container startup=%q", resolvedCmd)
		if _, createErr := h.docker.CreateContainer(ctx, docker.CreateContainerOptions{
			Name:             containerName,
			Image:            c.DockerImage,
			Env:              env,
			StopSignal:       dockerStopSignal(c.StopSignal),
			BindMount:        bindMount,
			MemoryLimitBytes: c.MemoryLimitMb * 1024 * 1024,
			CPULimitPercent:  c.CPULimitPercent,
			PidsLimit:        c.ProcessLimit,
			Ports:            ports,
		}); createErr != nil {
			log.Printf("daemon: create container on start: %v", createErr)
			state.watcher.SetState(ctx, lifecycle.StateCrashed, "servers.lifecycle.start_failed")
			return writeError(ctx, send, id, "internal.unexpected", nil)
		}
		log.Printf("daemon: container created, starting")

		if err := h.docker.StartContainer(ctx, containerName); err != nil {
			log.Printf("daemon: start container: %v", err)
			state.watcher.SetState(ctx, lifecycle.StateCrashed, "servers.lifecycle.start_failed")
			return writeError(ctx, send, id, "internal.unexpected", nil)
		}
		log.Printf("daemon: container started")

		h.startStats(context.Background(), state)
		// V1 parity: flip to running the moment Docker reports the container
		// is up. The previous probe-driven "wait for Done!" path could leave
		// the state stranded at 'starting' if the regex never matched, while
		// the container was clearly running. Crash detection still arms via
		// armCrashDetection if the blueprint declares it.
		state.watcher.SetState(context.Background(), lifecycle.StateRunning, "servers.lifecycle.started")
		if len(state.lifecycle.CrashDetection.Probes) > 0 {
			state.watcher.ArmCrashDetection(state.lifecycle)
		}
	case "stop":
		grace := 30
		if state.lifecycle.Stopping.GraceTimeoutMs > 0 {
			grace = state.lifecycle.Stopping.GraceTimeoutMs / 1000
		}
		stopStats(state)

		// Cancel any in-flight stopping probe so the synchronous wait is the
		// single source of the StateStopped emission. Probes can race with the
		// wait below and emit a transition we then ignore — but stopping the
		// probe loop avoids duplicate emits and stranded goroutines.
		state.watcher.Stop()
		state.watcher.SetState(context.Background(), lifecycle.StateStopping, "servers.lifecycle.stopping.requested")

		// Resolve the stop signal: prefer what was stored at start time, then
		// the value carried in this message (works after a daemon restart), then
		// fall back to inspecting the container config.
		sig := state.stopSignal
		if sig == "" {
			sig = msg.StopSignal
		}
		if sig == "" {
			sig = h.docker.InspectStopSignal(ctx, containerName)
		}
		state.stopSignal = sig

		// Synchronous stop — block until the container is gone, then emit
		// StateStopped. Mirrors Pelican's WaitForStop. The handler returns its
		// ack only after the transition completes so the worker (and through
		// it, the UI) sees a definitive result rather than hoping a goroutine
		// fires SetState later.
		stopErr := h.runSyncStop(containerName, sig, grace)
		if stopErr != nil {
			log.Printf("daemon: stop sequence: %v", stopErr)
		}
		state.watcher.SetState(context.Background(), lifecycle.StateStopped, "servers.lifecycle.stopped")
	case "kill":
		stopStats(state)
		if err := h.docker.KillContainer(ctx, containerName); err != nil {
			log.Printf("daemon: kill container: %v", err)
			return writeError(ctx, send, id, "internal.unexpected", nil)
		}
		state.watcher.SetState(
			context.Background(),
			lifecycle.StateStopped,
			"servers.lifecycle.stop_forced",
		)
	}
	return writeEnvelope(ctx, send, id, map[string]any{"type": "ack"})
}

func (h *Handler) handleDelete(
	ctx context.Context,
	id string,
	raw json.RawMessage,
	send Sender,
) error {
	var msg struct {
		ServerID    string `json:"serverId"`
		DeleteFiles bool   `json:"deleteFiles"`
	}
	if err := json.Unmarshal(raw, &msg); err != nil {
		return writeError(ctx, send, id, "internal.unexpected", nil)
	}

	h.mu.Lock()
	state := h.watchers[msg.ServerID]
	delete(h.watchers, msg.ServerID)
	h.mu.Unlock()
	if state != nil {
		stopStats(state)
		state.watcher.Stop()
	}

	containerName := "stellar-" + msg.ServerID
	_ = h.docker.RemoveContainer(ctx, containerName, true)
	if msg.DeleteFiles {
		_ = os.RemoveAll(filepath.Join(h.cfg.DataDir, "servers", msg.ServerID))
	}
	return writeEnvelope(ctx, send, id, map[string]any{"type": "ack"})
}

// LookupContainer returns the container name for a given server id (or
// the conventional "stellar-{serverId}" if no watcher is registered).
// Used by the console-WS attach endpoint to find the right target.
func (h *Handler) LookupContainer(serverID string) string {
	h.mu.Lock()
	defer h.mu.Unlock()
	if state, ok := h.watchers[serverID]; ok {
		return state.containerName
	}
	return "stellar-" + serverID
}

// Docker returns the underlying Docker client. The console-WS endpoint
// needs it to attach to a server's stdio.
func (h *Handler) Docker() *docker.Client {
	return h.docker
}

func writeEnvelope(
	ctx context.Context,
	send Sender,
	id string,
	message map[string]any,
) error {
	payload, err := json.Marshal(map[string]any{
		"id":      id,
		"message": message,
	})
	if err != nil {
		return err
	}
	return send.Send(ctx, payload)
}

func writeError(
	ctx context.Context,
	send Sender,
	id string,
	code string,
	params map[string]any,
) error {
	body := map[string]any{"type": "error", "code": code}
	if params != nil {
		body["params"] = params
	}
	return writeEnvelope(ctx, send, id, body)
}

func (h *Handler) handleCreateBackup(
	ctx context.Context,
	id string,
	raw json.RawMessage,
	send Sender,
) error {
	var msg struct {
		ServerID string `json:"serverId"`
		Name     string `json:"name"`
	}
	if err := json.Unmarshal(raw, &msg); err != nil {
		return writeError(ctx, send, id, "internal.unexpected", nil)
	}
	result, err := h.files.CreateBackup(msg.ServerID, msg.Name)
	if err != nil {
		log.Printf("daemon: create backup: %v", err)
		return writeError(ctx, send, id, "backups.upload_failed", nil)
	}
	return writeEnvelope(ctx, send, id, map[string]any{
		"type":   "ack",
		"path":   result.Path,
		"bytes":  result.Bytes,
		"sha256": result.SHA256,
	})
}

func (h *Handler) handleRestoreBackup(
	ctx context.Context,
	id string,
	raw json.RawMessage,
	send Sender,
) error {
	var msg struct {
		ServerID string `json:"serverId"`
		Name     string `json:"name"`
	}
	if err := json.Unmarshal(raw, &msg); err != nil {
		return writeError(ctx, send, id, "internal.unexpected", nil)
	}
	if err := h.files.RestoreBackup(msg.ServerID, msg.Name); err != nil {
		log.Printf("daemon: restore backup: %v", err)
		return writeError(ctx, send, id, "backups.upload_failed", nil)
	}
	return writeEnvelope(ctx, send, id, map[string]any{"type": "ack"})
}

func (h *Handler) handleDeleteBackup(
	ctx context.Context,
	id string,
	raw json.RawMessage,
	send Sender,
) error {
	var msg struct {
		ServerID string `json:"serverId"`
		Name     string `json:"name"`
		S3       *struct {
			Endpoint        string `json:"endpoint"`
			Region          string `json:"region"`
			Bucket          string `json:"bucket"`
			AccessKeyID     string `json:"accessKeyId"`
			SecretAccessKey string `json:"secretAccessKey"`
			ForcePathStyle  bool   `json:"forcePathStyle"`
			Key             string `json:"key"`
		} `json:"s3"`
	}
	if err := json.Unmarshal(raw, &msg); err != nil {
		return writeError(ctx, send, id, "internal.unexpected", nil)
	}
	if err := h.files.DeleteBackup(msg.ServerID, msg.Name); err != nil {
		log.Printf("daemon: delete backup file: %v", err)
	}
	if msg.S3 != nil && msg.S3.Bucket != "" && msg.S3.Key != "" {
		err := s3.DeleteObject(ctx, s3.Config{
			Endpoint:        msg.S3.Endpoint,
			Region:          msg.S3.Region,
			Bucket:          msg.S3.Bucket,
			AccessKeyID:     msg.S3.AccessKeyID,
			SecretAccessKey: msg.S3.SecretAccessKey,
			ForcePathStyle:  msg.S3.ForcePathStyle,
		}, msg.S3.Key)
		if err != nil {
			log.Printf("daemon: delete s3 object: %v", err)
		}
	}
	return writeEnvelope(ctx, send, id, map[string]any{"type": "ack"})
}

func (h *Handler) handleUploadBackupS3(
	ctx context.Context,
	id string,
	raw json.RawMessage,
	send Sender,
) error {
	var msg struct {
		ServerID    string `json:"serverId"`
		Name        string `json:"name"`
		Endpoint    string `json:"endpoint"`
		Region      string `json:"region"`
		Bucket      string `json:"bucket"`
		Prefix      string `json:"prefix"`
		AccessKeyID string `json:"accessKeyId"`
		SecretKey   string `json:"secretAccessKey"`
		ForcePath   bool   `json:"forcePathStyle"`
		SHA256      string `json:"sha256"`
	}
	if err := json.Unmarshal(raw, &msg); err != nil {
		return writeError(ctx, send, id, "internal.unexpected", nil)
	}
	reader, err := h.files.BackupReader(msg.ServerID, msg.Name)
	if err != nil {
		return writeError(ctx, send, id, "backups.upload_failed", nil)
	}
	defer reader.Close()
	stat, err := reader.Stat()
	if err != nil {
		return writeError(ctx, send, id, "backups.upload_failed", nil)
	}
	prefix := msg.Prefix
	if prefix != "" && prefix[len(prefix)-1] != '/' {
		prefix += "/"
	}
	key := prefix + msg.ServerID + "/" + msg.Name + ".tar.gz"
	uploadCtx, cancel := context.WithTimeout(ctx, 30*time.Minute)
	defer cancel()
	err = s3.PutObject(uploadCtx, s3.Config{
		Endpoint:        msg.Endpoint,
		Region:          msg.Region,
		Bucket:          msg.Bucket,
		AccessKeyID:     msg.AccessKeyID,
		SecretAccessKey: msg.SecretKey,
		ForcePathStyle:  msg.ForcePath,
	}, key, reader, stat.Size(), msg.SHA256)
	if err != nil {
		log.Printf("daemon: s3 put: %v", err)
		return writeError(ctx, send, id, "backups.upload_failed", map[string]any{
			"reason": err.Error(),
		})
	}
	return writeEnvelope(ctx, send, id, map[string]any{
		"type": "ack",
		"key":  key,
	})
}

func (h *Handler) handlePrepareTransfer(
	ctx context.Context,
	id string,
	raw json.RawMessage,
	send Sender,
) error {
	var msg struct {
		ServerID string `json:"serverId"`
		Token    string `json:"token"`
	}
	if err := json.Unmarshal(raw, &msg); err != nil {
		return writeError(ctx, send, id, "internal.unexpected", nil)
	}
	h.Transfer.Register(msg.Token, msg.ServerID)
	return writeEnvelope(ctx, send, id, map[string]any{"type": "ack"})
}

func (h *Handler) handlePushTransfer(
	ctx context.Context,
	id string,
	raw json.RawMessage,
	send Sender,
) error {
	var msg struct {
		ServerID  string `json:"serverId"`
		TargetURL string `json:"targetUrl"`
		Token     string `json:"token"`
	}
	if err := json.Unmarshal(raw, &msg); err != nil {
		return writeError(ctx, send, id, "internal.unexpected", nil)
	}
	pushCtx, cancel := context.WithTimeout(ctx, 30*time.Minute)
	defer cancel()
	if err := transfer.PushToTarget(pushCtx, h.files, msg.ServerID, msg.TargetURL, msg.Token); err != nil {
		log.Printf("daemon: push_transfer: %v", err)
		return writeError(ctx, send, id, "transfers.push_failed", nil)
	}
	return writeEnvelope(ctx, send, id, map[string]any{"type": "ack"})
}

func (h *Handler) handleSendConsole(
	ctx context.Context,
	id string,
	raw json.RawMessage,
	send Sender,
) error {
	var msg struct {
		ServerID string `json:"serverId"`
		Line     string `json:"line"`
	}
	if err := json.Unmarshal(raw, &msg); err != nil {
		return writeError(ctx, send, id, "internal.unexpected", nil)
	}

	h.mu.Lock()
	state := h.watchers[msg.ServerID]
	h.mu.Unlock()
	containerName := "stellar-" + msg.ServerID
	if state != nil {
		containerName = state.containerName
	}

	conn, _, err := h.docker.AttachConn(ctx, containerName)
	if err != nil {
		log.Printf("daemon: send_console attach: %v", err)
		return writeError(ctx, send, id, "internal.unexpected", nil)
	}
	defer conn.Close()
	if _, err := io.WriteString(conn, msg.Line+"\n"); err != nil {
		log.Printf("daemon: send_console write: %v", err)
		return writeError(ctx, send, id, "internal.unexpected", nil)
	}
	return writeEnvelope(ctx, send, id, map[string]any{"type": "ack"})
}

// dockerStopSignal returns a valid Docker stop signal for the container config.
// Signals prefixed with "^" are stdin commands (e.g. "^stop"), not Unix signals;
// passing them to Docker would be silently ignored. Return empty string so Docker
// defaults to SIGTERM, which triggers the grace period before force-kill.
func dockerStopSignal(sig string) string {
	if strings.HasPrefix(sig, "^") {
		return ""
	}
	return sig
}

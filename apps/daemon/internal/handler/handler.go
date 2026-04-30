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

// Handler routes inbound messages to docker calls. Per-server state (the
// lifecycle.Watcher and its blueprint lifecycle config) is held in
// `watchers` so power-action and lifecycle-transition handling can find
// the existing state machine.
type Handler struct {
	cfg      *config.Config
	docker   *docker.Client
	files    *files.Manager
	Transfer *transfer.Registry

	mu       sync.Mutex
	watchers map[string]*serverState

	powerLocksMu sync.Mutex
	powerLocks   map[string]*sync.Mutex
}

type serverState struct {
	containerName string
	watcher       *lifecycle.Watcher
	lifecycle     lifecycle.Lifecycle
	statsCancel   context.CancelFunc
}

// New returns a Handler bound to the local Docker socket.
func New(cfg *config.Config) *Handler {
	return &Handler{
		cfg:      cfg,
		docker:   docker.New(""),
		files:    files.New(cfg.DataDir),
		Transfer: transfer.NewRegistry(),
		watchers: map[string]*serverState{},
	}
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

// startStats launches a goroutine that streams Docker container stats and
// emits server.stats frames via send. Any previously running stats goroutine
// for the same server is cancelled first. The goroutine stops automatically
// when the container exits or ctx is cancelled.
func (h *Handler) startStats(ctx context.Context, state *serverState, send Sender) {
	if state.statsCancel != nil {
		state.statsCancel()
	}
	sctx, cancel := context.WithCancel(ctx)
	state.statsCancel = cancel
	go func() {
		ch, err := h.docker.StatsStream(sctx, state.containerName)
		if err != nil {
			log.Printf("daemon: stats stream: %v", err)
			return
		}
		for snap := range ch {
			_ = writeEnvelope(sctx, send, "", map[string]any{
				"type":             "server.stats",
				"serverId":         strings.TrimPrefix(state.containerName, "stellar-"),
				"memoryBytes":      snap.MemoryBytes,
				"memoryLimitBytes": snap.MemoryLimitBytes,
				"cpuFraction":      snap.CPUFraction,
				"diskBytes":        int64(0),
				"networkRxBytes":   snap.NetworkRxBytes,
				"networkTxBytes":   snap.NetworkTxBytes,
				"at":               time.Now().UTC().Format(time.RFC3339Nano),
			})
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

// Resume scans Docker for already-running stellar-* containers and resumes
// stats streaming for each. Called once after the daemon WS connects so the
// panel receives stats for servers that were running before the daemon (re)started.
func (h *Handler) Resume(ctx context.Context, send Sender) {
	containers, err := h.docker.ListRunningContainers(ctx, "stellar-")
	if err != nil {
		log.Printf("daemon: resume scan: %v", err)
		return
	}
	h.mu.Lock()
	for _, c := range containers {
		if _, exists := h.watchers[strings.TrimPrefix(c.Name, "stellar-")]; exists {
			continue // already tracked from a create-container in this session
		}
		serverID := strings.TrimPrefix(c.Name, "stellar-")
		w := lifecycle.New(serverID, c.Name, h.docker, send)
		state := &serverState{
			containerName: c.Name,
			watcher:       w,
			lifecycle:     lifecycle.Lifecycle{},
		}
		h.watchers[serverID] = state
		log.Printf("daemon: resume server=%s container=%s", serverID, c.Name)
		go h.startStats(ctx, state, send)
	}
	h.mu.Unlock()
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
		Environment     map[string]string `json:"environment"`
		PortMappings    []struct {
			IP            string `json:"ip"`
			Port          int    `json:"port"`
			ContainerPort int    `json:"containerPort"`
		} `json:"portMappings"`
		StartupCommand string              `json:"startupCommand"`
		StopSignal     string              `json:"stopSignal"`
		Lifecycle      lifecycle.Lifecycle `json:"lifecycle"`
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

	createCtx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()
	_, err := h.docker.CreateContainer(createCtx, docker.CreateContainerOptions{
		Name:             containerName,
		Image:            msg.DockerImage,
		Env:              msg.Environment,
		Cmd:              []string{"/bin/sh", "-lc", msg.StartupCommand},
		StopSignal:       msg.StopSignal,
		BindMount:        bindMount,
		MemoryLimitBytes: msg.MemoryLimitMb * 1024 * 1024,
		CPULimitPercent:  msg.CPULimitPercent,
		Ports:            ports,
		ReadonlyRootfs:   true,
	})
	if err != nil {
		log.Printf("daemon: create container: %v", err)
		return writeError(ctx, send, id, "internal.unexpected", nil)
	}

	h.mu.Lock()
	h.watchers[msg.ServerID] = &serverState{
		containerName: containerName,
		watcher:       lifecycle.New(msg.ServerID, containerName, h.docker, send),
		lifecycle:     msg.Lifecycle,
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
		BindMount:  bindMount,
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
		ServerID string `json:"serverId"`
	}
	if err := json.Unmarshal(raw, &msg); err != nil {
		return writeError(ctx, send, id, "internal.unexpected", nil)
	}

	log.Printf("daemon: power action=%s server=%s", action, msg.ServerID)

	lock := h.powerLock(msg.ServerID)
	lock.Lock()
	defer lock.Unlock()

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
		w := lifecycle.New(msg.ServerID, containerName, h.docker, send)
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
		if err := h.docker.StartContainer(ctx, containerName); err != nil {
			log.Printf("daemon: start container: %v", err)
			return writeError(ctx, send, id, "internal.unexpected", nil)
		}
		h.startStats(context.Background(), state, send)
		if len(state.lifecycle.Starting.Probes) > 0 {
			state.watcher.OnStarting(context.Background(), state.lifecycle)
		} else {
			state.watcher.SetState(context.Background(), lifecycle.StateRunning, "servers.lifecycle.started")
		}
	case "stop":
		grace := 30
		if state.lifecycle.Stopping.GraceTimeoutMs > 0 {
			grace = state.lifecycle.Stopping.GraceTimeoutMs / 1000
		}
		stopStats(state)
		if len(state.lifecycle.Stopping.Probes) > 0 {
			state.watcher.OnStopping(context.Background(), state.lifecycle)
		} else {
			state.watcher.Stop()
			state.watcher.SetState(context.Background(), lifecycle.StateStopping, "servers.lifecycle.stopping.requested")
		}
		if err := h.docker.StopContainer(ctx, containerName, grace); err != nil {
			log.Printf("daemon: stop container: %v", err)
			return writeError(ctx, send, id, "internal.unexpected", nil)
		}
		if len(state.lifecycle.Stopping.Probes) == 0 {
			state.watcher.SetState(context.Background(), lifecycle.StateStopped, "servers.lifecycle.stopped")
		}
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

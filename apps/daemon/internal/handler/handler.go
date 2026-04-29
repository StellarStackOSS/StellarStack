// Package handler dispatches inbound worker→daemon WS frames to the right
// docker / lifecycle code path and produces the matching response envelope.
package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/stellarstack/daemon/internal/config"
	"github.com/stellarstack/daemon/internal/docker"
)

// Sender is anything that can emit a JSON-encoded envelope back to the API
// over the daemon's WebSocket. The ws package implements this against the
// live socket; tests can stand it in with an in-memory recorder.
type Sender interface {
	Send(ctx context.Context, payload []byte) error
}

// Handler routes inbound messages to docker calls.
type Handler struct {
	cfg    *config.Config
	docker *docker.Client
}

// New returns a Handler bound to the local Docker socket.
func New(cfg *config.Config) *Handler {
	return &Handler{
		cfg:    cfg,
		docker: docker.New(""),
	}
}

// HandleEnvelope inspects the message type and dispatches. Replies (ack /
// error / streaming log lines) are written through `send`. Returns nil when
// the frame was handled, even if the underlying operation produced an
// error envelope — the caller doesn't need to know the difference.
func (h *Handler) HandleEnvelope(ctx context.Context, raw []byte, send Sender) error {
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
		Type             string            `json:"type"`
		ServerID         string            `json:"serverId"`
		DockerImage      string            `json:"dockerImage"`
		MemoryLimitMb    int64             `json:"memoryLimitMb"`
		CPULimitPercent  int64             `json:"cpuLimitPercent"`
		Environment      map[string]string `json:"environment"`
		PortMappings     []struct {
			IP            string `json:"ip"`
			Port          int    `json:"port"`
			ContainerPort int    `json:"containerPort"`
		} `json:"portMappings"`
		StartupCommand string `json:"startupCommand"`
		StopSignal     string `json:"stopSignal"`
	}
	if err := json.Unmarshal(raw, &msg); err != nil {
		return writeError(ctx, send, id, "internal.unexpected", nil)
	}

	bindMount := filepath.Join(h.cfg.DataDir, "servers", msg.ServerID)
	if err := os.MkdirAll(bindMount, 0o755); err != nil {
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
	})
	if err != nil {
		log.Printf("daemon: create container: %v", err)
		return writeError(ctx, send, id, "internal.unexpected", nil)
	}
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

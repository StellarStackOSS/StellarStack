package router

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/stellarstack/daemon/internal/docker"
)

// dbContainerName is the Docker name we use for database hosts. The
// "stellar-db-" prefix keeps them out of the game-server reconcile pass
// (which scans `stellar-` and skips entries beginning with "install-").
func dbContainerName(uuid string) string {
	return "stellar-db-" + uuid
}

// provisionRequest is the API → daemon body for creating a database
// host. The daemon is dumb: it just runs the container with the supplied
// image, env, port, and resource caps. The API owns generation of root
// credentials and the database-type registry.
type provisionRequest struct {
	HostUUID      string            `json:"host_uuid"`
	Image         string            `json:"image"`
	HostPort      int               `json:"host_port"`
	ContainerPort int               `json:"container_port"`
	Env           map[string]string `json:"env"`
	MemoryLimitMb int64             `json:"memory_limit_mb"`
	DiskLimitMb   int64             `json:"disk_limit_mb"`
}

type execRequest struct {
	Cmd []string `json:"cmd"`
}

type execResponse struct {
	ExitCode int    `json:"exit_code"`
	Stdout   string `json:"stdout"`
	Stderr   string `json:"stderr"`
}

// routeDatabases handles /api/databases/{uuid}[/exec] for HMAC-signed
// API requests.
func (r *Router) routeDatabases(w http.ResponseWriter, req *http.Request) {
	parts := strings.Split(strings.Trim(req.URL.Path, "/"), "/")
	if len(parts) < 3 || parts[0] != "api" || parts[1] != "databases" {
		http.NotFound(w, req)
		return
	}
	if !r.verifyDaemonHMAC(req) {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	uuid := parts[2]

	switch {
	case len(parts) == 3 && req.Method == http.MethodPost:
		r.handleDatabaseProvision(w, req, uuid)
	case len(parts) == 3 && req.Method == http.MethodDelete:
		r.handleDatabaseDelete(w, req, uuid)
	case len(parts) == 4 && parts[3] == "exec" && req.Method == http.MethodPost:
		r.handleDatabaseExec(w, req, uuid)
	default:
		http.NotFound(w, req)
	}
}

func (r *Router) handleDatabaseProvision(w http.ResponseWriter, req *http.Request, uuid string) {
	var body provisionRequest
	if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
		writeJSONError(w, http.StatusBadRequest, "validation.failed")
		return
	}
	if body.Image == "" || body.HostPort == 0 || body.ContainerPort == 0 {
		writeJSONError(w, http.StatusBadRequest, "validation.failed")
		return
	}

	ctx, cancel := context.WithTimeout(req.Context(), 5*time.Minute)
	defer cancel()

	name := dbContainerName(uuid)

	if err := r.manager.DockerClient().EnsureImage(ctx, body.Image); err != nil {
		log.Printf("databases: pull %s: %v", body.Image, err)
		writeJSONError(w, http.StatusBadGateway, "internal.unexpected")
		return
	}

	// Best-effort remove of any existing container so this is idempotent.
	_ = r.manager.DockerClient().RemoveContainer(ctx, name, true)

	dataDir := filepath.Join(r.cfg.DataDir, "databases", uuid)
	opts := docker.CreateContainerOptions{
		Name:             name,
		Image:            body.Image,
		Env:              body.Env,
		MemoryLimitBytes: body.MemoryLimitMb * 1024 * 1024,
		BindMount:        dataDir,
		Ports: []docker.PortMapping{{
			HostPort:      body.HostPort,
			ContainerPort: body.ContainerPort,
		}},
	}
	if _, err := r.manager.DockerClient().CreateContainer(ctx, opts); err != nil {
		log.Printf("databases: create %s: %v", name, err)
		writeJSONError(w, http.StatusBadGateway, "internal.unexpected")
		return
	}
	if err := r.manager.DockerClient().StartContainer(ctx, name); err != nil {
		log.Printf("databases: start %s: %v", name, err)
		writeJSONError(w, http.StatusBadGateway, "internal.unexpected")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (r *Router) handleDatabaseDelete(w http.ResponseWriter, req *http.Request, uuid string) {
	ctx, cancel := context.WithTimeout(req.Context(), 30*time.Second)
	defer cancel()
	if err := r.manager.DockerClient().RemoveContainer(ctx, dbContainerName(uuid), true); err != nil {
		var notFound *docker.ContainerNotFoundError
		if !errors.As(err, &notFound) {
			log.Printf("databases: remove %s: %v", uuid, err)
		}
	}
	w.WriteHeader(http.StatusNoContent)
}

func (r *Router) handleDatabaseExec(w http.ResponseWriter, req *http.Request, uuid string) {
	var body execRequest
	if err := json.NewDecoder(req.Body).Decode(&body); err != nil || len(body.Cmd) == 0 {
		writeJSONError(w, http.StatusBadRequest, "validation.failed")
		return
	}
	ctx, cancel := context.WithTimeout(req.Context(), 60*time.Second)
	defer cancel()
	res, err := r.manager.DockerClient().Exec(ctx, dbContainerName(uuid), body.Cmd)
	if err != nil {
		log.Printf("databases: exec %s: %v", uuid, err)
		writeJSONError(w, http.StatusBadGateway, "internal.unexpected")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(execResponse{
		ExitCode: res.ExitCode,
		Stdout:   res.Stdout,
		Stderr:   res.Stderr,
	})
}

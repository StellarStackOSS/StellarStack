package router

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/stellarstack/daemon/internal/environment"
)

// handleDelete force-removes the server's Docker container. The data
// directory on the host is intentionally left alone — its lifecycle is
// owned by the host operator (volumes, snapshots, retention scripts),
// not the daemon. Returns 204 on success.
func (r *Router) handleDelete(w http.ResponseWriter, req *http.Request, serverUUID string) {
	if req.Method != http.MethodDelete {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	srv := r.manager.Get(serverUUID)
	containerName := srv.Environment().ContainerName()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Environment().Docker().RemoveContainer(ctx, containerName, true); err != nil {
		log.Printf("server %s: delete remove container: %v", serverUUID, err)
		writeJSONError(w, http.StatusInternalServerError, "delete.remove_failed")
		return
	}
	srv.Environment().ForceState(environment.StateOffline)
	r.manager.Forget(serverUUID)
	w.WriteHeader(http.StatusNoContent)
}

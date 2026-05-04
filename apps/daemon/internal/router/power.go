package router

import (
	"context"
	"net/http"
	"time"

	"github.com/stellarstack/daemon/internal/server"
)

// handlePower is the API-facing HTTP power endpoint. Mirrors the
// `set state` WS event but reachable from server-side processes that
// don't hold a browser session — currently the schedule executor.
//
// HMAC-authenticated, body: { action: "start" | "stop" | "restart" | "kill" }.
// Returns once the daemon has the action queued; status is observable via
// the usual /api/remote/servers/:id/container/status callback.
func (r *Router) handlePower(w http.ResponseWriter, req *http.Request, serverID string) {
	if !r.verifyDaemonHMAC(req) {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	var body struct {
		Action string `json:"action"`
	}
	if err := decodeJSON(req, &body); err != nil {
		writeJSONError(w, http.StatusBadRequest, "power.bad_request")
		return
	}
	switch body.Action {
	case "start", "stop", "restart", "kill":
	default:
		writeJSONError(w, http.StatusBadRequest, "power.unknown_action")
		return
	}
	srv := r.manager.Get(serverID)
	go func(action string) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
		defer cancel()
		_ = srv.HandlePower(ctx, server.PowerAction(action))
	}(body.Action)
	writeJSON(w, map[string]any{"ok": true})
}

// handleCommand writes a single line to the container's stdin via a
// fresh attach. HMAC-authenticated; used by schedule tasks of type
// "command".
func (r *Router) handleCommand(w http.ResponseWriter, req *http.Request, serverID string) {
	if !r.verifyDaemonHMAC(req) {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	var body struct {
		Line string `json:"line"`
	}
	if err := decodeJSON(req, &body); err != nil {
		writeJSONError(w, http.StatusBadRequest, "command.bad_request")
		return
	}
	if body.Line == "" {
		writeJSONError(w, http.StatusBadRequest, "command.empty")
		return
	}
	srv := r.manager.Get(serverID)
	ctx, cancel := context.WithTimeout(req.Context(), 5*time.Second)
	defer cancel()
	if err := srv.Environment().SendCommand(ctx, body.Line); err != nil {
		writeJSONError(w, http.StatusBadRequest, "command.send_failed")
		return
	}
	writeJSON(w, map[string]any{"ok": true})
}

package router

import (
	"encoding/json"
	"net/http"
)

// handleBackups is invoked by the API (HMAC-authenticated, not browser
// JWT) for create / restore / delete. The browser never hits the daemon
// directly for backup ops — the API mediates so we can persist DB state.
func (r *Router) handleBackups(w http.ResponseWriter, req *http.Request, serverID string) {
	if r.backups == nil {
		http.Error(w, "backups disabled", http.StatusServiceUnavailable)
		return
	}
	if !r.verifyDaemonHMAC(req) {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	op := req.URL.Query().Get("op")
	switch op {
	case "create":
		var body struct{ Name string }
		if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
			writeJSONError(w, http.StatusBadRequest, "backups.bad_request")
			return
		}
		res, err := r.backups.Create(serverID, body.Name)
		if err != nil {
			writeJSONError(w, http.StatusInternalServerError, "backups.create_failed")
			return
		}
		writeJSON(w, res)
	case "restore":
		var body struct{ Name string }
		if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
			writeJSONError(w, http.StatusBadRequest, "backups.bad_request")
			return
		}
		if err := r.backups.Restore(serverID, body.Name); err != nil {
			writeJSONError(w, http.StatusInternalServerError, "backups.restore_failed")
			return
		}
		writeJSON(w, map[string]any{"ok": true})
	case "delete":
		var body struct{ Name string }
		if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
			writeJSONError(w, http.StatusBadRequest, "backups.bad_request")
			return
		}
		if err := r.backups.Delete(serverID, body.Name); err != nil {
			writeJSONError(w, http.StatusInternalServerError, "backups.delete_failed")
			return
		}
		writeJSON(w, map[string]any{"ok": true})
	default:
		http.NotFound(w, req)
	}
}

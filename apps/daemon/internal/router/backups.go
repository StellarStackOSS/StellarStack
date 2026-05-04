package router

import (
	"encoding/json"
	"fmt"
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
	srv := r.manager.Get(serverID)
	switch op {
	case "create":
		var body struct{ Name string }
		if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
			writeJSONError(w, http.StatusBadRequest, "backups.bad_request")
			return
		}
		srv.PublishDaemon("Creating backup '" + body.Name + "', this can take a while...")
		res, err := r.backups.Create(serverID, body.Name)
		if err != nil {
			srv.PublishDaemon("Backup '" + body.Name + "' failed: " + err.Error())
			writeJSONError(w, http.StatusInternalServerError, "backups.create_failed")
			return
		}
		srv.PublishDaemon(fmt.Sprintf("Backup '%s' complete (%.2f MB)", body.Name, float64(res.Bytes)/1024/1024))
		writeJSON(w, res)
	case "restore":
		var body struct{ Name string }
		if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
			writeJSONError(w, http.StatusBadRequest, "backups.bad_request")
			return
		}
		srv.PublishDaemon("Restoring backup '" + body.Name + "'...")
		if err := r.backups.Restore(serverID, body.Name); err != nil {
			srv.PublishDaemon("Restore failed: " + err.Error())
			writeJSONError(w, http.StatusInternalServerError, "backups.restore_failed")
			return
		}
		srv.PublishDaemon("Restore of '" + body.Name + "' complete")
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

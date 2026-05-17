package router

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// fileDownloadRequest is what the panel POSTs when an admin clicks
// "install" on a Modrinth/CurseForge result. The daemon streams the
// remote URL into the server's data dir at the requested relative path.
type fileDownloadRequest struct {
	URL  string `json:"url"`
	Dest string `json:"dest"`
}

// handleFileDownload is auth'd with the daemon HMAC (not a browser JWT)
// because the request originates from the API process. The destination
// path is sanitised: must be relative, must not escape via "..".
func (r *Router) handleFileDownload(w http.ResponseWriter, req *http.Request, serverID string) {
	if r.files == nil {
		http.Error(w, "files disabled", http.StatusServiceUnavailable)
		return
	}
	var body fileDownloadRequest
	if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
		writeJSONError(w, http.StatusBadRequest, "files.invalid_body")
		return
	}
	if body.URL == "" || body.Dest == "" {
		writeJSONError(w, http.StatusBadRequest, "files.missing_fields")
		return
	}
	if !strings.HasPrefix(body.URL, "https://") && !strings.HasPrefix(body.URL, "http://") {
		writeJSONError(w, http.StatusBadRequest, "files.bad_url_scheme")
		return
	}
	cleaned := filepath.Clean(body.Dest)
	if strings.HasPrefix(cleaned, "..") || strings.HasPrefix(cleaned, "/") {
		writeJSONError(w, http.StatusBadRequest, "files.bad_path")
		return
	}

	absPath, err := r.files.AbsPath(serverID, cleaned)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "files.bad_server")
		return
	}
	if err := os.MkdirAll(filepath.Dir(absPath), 0o755); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "files.mkdir_failed")
		return
	}

	client := &http.Client{Timeout: 10 * time.Minute}
	resp, err := client.Get(body.URL)
	if err != nil {
		writeJSONError(w, http.StatusBadGateway, "files.fetch_failed")
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		writeJSONError(w, http.StatusBadGateway, fmt.Sprintf("files.fetch_status_%d", resp.StatusCode))
		return
	}

	// Write to a temp file in the same dir so we can atomic-rename on
	// success and not leave a half-written jar that the game loader
	// trips over.
	tmp, err := os.CreateTemp(filepath.Dir(absPath), ".download-*")
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "files.tmp_failed")
		return
	}
	tmpPath := tmp.Name()
	written, err := io.Copy(tmp, resp.Body)
	tmp.Close()
	if err != nil {
		os.Remove(tmpPath)
		writeJSONError(w, http.StatusInternalServerError, "files.write_failed")
		return
	}
	if err := os.Rename(tmpPath, absPath); err != nil {
		os.Remove(tmpPath)
		writeJSONError(w, http.StatusInternalServerError, "files.rename_failed")
		return
	}

	writeJSON(w, map[string]any{
		"ok":    true,
		"path":  cleaned,
		"bytes": written,
	})
}

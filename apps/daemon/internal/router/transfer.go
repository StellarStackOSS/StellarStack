package router

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// transferTokenWindow is how far apart the source's signed token can be
// from the target's clock before we reject. 5-minute skew tolerance.
const transferTokenWindow = 5 * time.Minute

// handleTransferIngest is the target-side endpoint the source daemon
// pushes a tarball into. Authenticated via a one-time token signed with
// the per-node HMAC the API minted at transfer-start time.
//
// Body is the same .tar.gz format the backup module emits; the daemon
// extracts into the bind mount and replies 200 on success.
func (r *Router) handleTransferIngest(w http.ResponseWriter, req *http.Request, serverID string) {
	if !verifyTransferToken(req, r.cfg.SigningKeyHex) {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	dst := filepath.Join(r.cfg.DataDir, "servers", serverID)
	if err := os.MkdirAll(dst, 0o755); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "transfer.mkdir_failed")
		return
	}
	gz, err := gzip.NewReader(req.Body)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "transfer.bad_archive")
		return
	}
	defer gz.Close()
	tr := tar.NewReader(gz)
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			writeJSONError(w, http.StatusBadRequest, "transfer.read_failed")
			return
		}
		clean := filepath.Clean("/" + hdr.Name)
		target := filepath.Join(dst, clean)
		if !strings.HasPrefix(target, dst) {
			writeJSONError(w, http.StatusBadRequest, "transfer.path_escape")
			return
		}
		switch hdr.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(target, os.FileMode(hdr.Mode)); err != nil {
				writeJSONError(w, http.StatusInternalServerError, "transfer.mkdir_failed")
				return
			}
		case tar.TypeReg, tar.TypeRegA:
			if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
				writeJSONError(w, http.StatusInternalServerError, "transfer.mkdir_failed")
				return
			}
			f, err := os.OpenFile(target, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, os.FileMode(hdr.Mode))
			if err != nil {
				writeJSONError(w, http.StatusInternalServerError, "transfer.write_failed")
				return
			}
			if _, err := io.Copy(f, tr); err != nil {
				f.Close()
				writeJSONError(w, http.StatusInternalServerError, "transfer.write_failed")
				return
			}
			f.Close()
		}
	}
	writeJSON(w, map[string]any{"ok": true})
}

// handleTransferPush is the source-side endpoint the API hits to start
// the byte transfer. Authenticated by daemon HMAC. Body specifies the
// target node URL + the one-time token to present.
func (r *Router) handleTransferPush(w http.ResponseWriter, req *http.Request, serverID string) {
	if !r.verifyDaemonHMAC(req) {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	var body struct {
		TargetURL  string `json:"targetUrl"`
		Token      string `json:"token"`
		Timestamp  int64  `json:"timestamp"`
	}
	if err := decodeJSON(req, &body); err != nil {
		writeJSONError(w, http.StatusBadRequest, "transfer.bad_request")
		return
	}

	src := filepath.Join(r.cfg.DataDir, "servers", serverID)
	if _, err := os.Stat(src); err != nil {
		writeJSONError(w, http.StatusNotFound, "transfer.no_source")
		return
	}

	pr, pw := io.Pipe()
	// Stream the tarball directly into the HTTP request body so we don't
	// need to stage a multi-GB archive on disk first.
	go func() {
		defer pw.Close()
		gz := gzip.NewWriter(pw)
		tw := tar.NewWriter(gz)
		walkErr := filepath.Walk(src, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return err
			}
			rel, err := filepath.Rel(src, path)
			if err != nil {
				return err
			}
			if rel == "." {
				return nil
			}
			hdr, err := tar.FileInfoHeader(info, "")
			if err != nil {
				return err
			}
			hdr.Name = rel
			if err := tw.WriteHeader(hdr); err != nil {
				return err
			}
			if !info.Mode().IsRegular() {
				return nil
			}
			f, err := os.Open(path)
			if err != nil {
				return err
			}
			defer f.Close()
			_, err = io.Copy(tw, f)
			return err
		})
		if walkErr != nil {
			pw.CloseWithError(walkErr)
			return
		}
		if err := tw.Close(); err != nil {
			pw.CloseWithError(err)
			return
		}
		_ = gz.Close()
	}()

	ctx, cancel := context.WithTimeout(req.Context(), 30*time.Minute)
	defer cancel()
	pushReq, err := http.NewRequestWithContext(ctx, http.MethodPost, body.TargetURL, pr)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "transfer.bad_target")
		return
	}
	pushReq.Header.Set("Content-Type", "application/x-gtar")
	pushReq.Header.Set("X-Stellar-Transfer-Token", body.Token)
	pushReq.Header.Set("X-Stellar-Transfer-Timestamp",
		fmt.Sprintf("%d", body.Timestamp))

	pushResp, err := http.DefaultClient.Do(pushReq)
	if err != nil {
		writeJSONError(w, http.StatusBadGateway, "transfer.push_failed")
		return
	}
	defer pushResp.Body.Close()
	if pushResp.StatusCode/100 != 2 {
		writeJSONError(w, http.StatusBadGateway, "transfer.target_rejected")
		return
	}
	writeJSON(w, map[string]any{"ok": true})
}

// verifyTransferToken checks the source-supplied token: the source
// computed HMAC(targetNodeKey, "<serverId>|<timestamp>") and put the
// hex digest in `X-Stellar-Transfer-Token`. The target verifies with
// its own per-node key. Window enforces freshness.
func verifyTransferToken(req *http.Request, signingKeyHex string) bool {
	tok := req.Header.Get("X-Stellar-Transfer-Token")
	tsStr := req.Header.Get("X-Stellar-Transfer-Timestamp")
	if tok == "" || tsStr == "" {
		return false
	}
	ts := parseInt64(tsStr)
	if ts == 0 {
		return false
	}
	if abs(time.Now().Unix()-ts) > int64(transferTokenWindow.Seconds()) {
		return false
	}
	parts := strings.Split(strings.Trim(req.URL.Path, "/"), "/")
	if len(parts) < 4 {
		return false
	}
	serverID := parts[2]
	key, err := hex.DecodeString(signingKeyHex)
	if err != nil {
		return false
	}
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(fmt.Sprintf("%s|%d", serverID, ts)))
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(tok))
}

func parseInt64(s string) int64 {
	var v int64
	for _, b := range []byte(s) {
		if b < '0' || b > '9' {
			return 0
		}
		v = v*10 + int64(b-'0')
	}
	return v
}

func decodeJSON(req *http.Request, dst any) error {
	return json.NewDecoder(io.LimitReader(req.Body, 16*1024)).Decode(dst)
}

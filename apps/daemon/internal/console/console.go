// Package console hosts the browser-facing console WebSocket. Browsers
// connect directly to wss://node/servers/:id/ws (skipping the API on the
// data path) authenticated by a short-lived JWT that the API mints with
// the per-node signing secret.
package console

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/coder/websocket"

	"github.com/stellarstack/daemon/internal/handler"
	stellarjwt "github.com/stellarstack/daemon/internal/jwt"
)

const (
	throttleLines    = 500
	throttleWindowMs = 1000
)

type lineThrottle struct {
	mu        sync.Mutex
	count     int
	windowEnd time.Time
	throttled bool
}

func (t *lineThrottle) allow() bool {
	t.mu.Lock()
	defer t.mu.Unlock()
	now := time.Now()
	if now.After(t.windowEnd) {
		t.count = 0
		t.windowEnd = now.Add(throttleWindowMs * time.Millisecond)
		t.throttled = false
	}
	t.count++
	return t.count <= throttleLines
}

// Server hosts the console WebSocket endpoint.
type Server struct {
	verifier *stellarjwt.Verifier
	handler  *handler.Handler
}

// New returns a Server bound to the supplied verifier + handler.
func New(verifier *stellarjwt.Verifier, h *handler.Handler) *Server {
	return &Server{verifier: verifier, handler: h}
}

// HandleConsole is the dispatcher for `/servers/:id/ws` upgrades. Returns
// true when the request matched (whether it succeeded or not); the daemon
// main composes this with the file API dispatcher under a single mux
// entry.
func (s *Server) HandleConsole(w http.ResponseWriter, r *http.Request) bool {
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) != 3 || parts[0] != "servers" || parts[2] != "ws" {
		return false
	}
	s.handle(w, r)
	return true
}

func (s *Server) handle(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) != 3 || parts[0] != "servers" || parts[2] != "ws" {
		http.NotFound(w, r)
		return
	}
	serverID := parts[1]

	token := r.URL.Query().Get("token")
	if token == "" {
		http.Error(w, "missing token", http.StatusUnauthorized)
		return
	}
	claims, err := s.verifier.Verify(token)
	if err != nil {
		http.Error(w, fmt.Sprintf("invalid token: %v", err), http.StatusUnauthorized)
		return
	}
	if claims.Server != serverID {
		http.Error(w, "token scoped to different server", http.StatusUnauthorized)
		return
	}
	if !claims.HasScope("console.read") {
		http.Error(w, "missing console.read scope", http.StatusForbidden)
		return
	}
	allowWrite := claims.HasScope("console.write")

	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		OriginPatterns:  []string{"*"},
		CompressionMode: websocket.CompressionDisabled,
	})
	if err != nil {
		log.Printf("console: accept: %v", err)
		return
	}
	defer conn.Close(websocket.StatusNormalClosure, "bye")

	containerName := s.handler.LookupContainer(serverID)
	dockerClient := s.handler.Docker()

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()

	// Replay the last 150 lines from Docker's log buffer before going live.
	// This mirrors what Wings does: the browser sees recent history immediately
	// on connect without the daemon needing its own ring buffer.
	if logReader, err := dockerClient.TailLogs(ctx, containerName, 150); err == nil {
		replayDockerLogs(ctx, conn, logReader)
		logReader.Close()
	}

	attachConn, attachReader, err := dockerClient.AttachConn(ctx, containerName)
	if err != nil {
		_ = conn.Write(ctx, websocket.MessageText, mustJSON(map[string]any{
			"type": "error",
			"code": "internal.unexpected",
		}))
		return
	}
	defer attachConn.Close()

	go pumpDockerToWS(ctx, conn, attachReader)
	if allowWrite {
		pumpWSToDocker(ctx, conn, attachConn)
	} else {
		pumpWSToVoid(ctx, conn)
	}
}

// replayDockerLogs sends historical log lines from Docker's log buffer as
// console.line frames with "historical": true so the frontend can style them
// differently or simply insert them before the live stream.
func replayDockerLogs(ctx context.Context, ws *websocket.Conn, r io.Reader) {
	header := make([]byte, 8)
	for {
		if _, err := io.ReadFull(r, header); err != nil {
			return
		}
		streamID := header[0]
		size := int(header[4])<<24 | int(header[5])<<16 | int(header[6])<<8 | int(header[7])
		if size <= 0 {
			continue
		}
		payload := make([]byte, size)
		if _, err := io.ReadFull(r, payload); err != nil {
			return
		}
		stream := "stdout"
		if streamID == 2 {
			stream = "stderr"
		}
		for _, line := range strings.Split(strings.TrimRight(string(payload), "\n"), "\n") {
			if line == "" {
				continue
			}
			frame := mustJSON(map[string]any{
				"type":       "console.line",
				"stream":     stream,
				"line":       line,
				"historical": true,
			})
			if err := ws.Write(ctx, websocket.MessageText, frame); err != nil {
				return
			}
		}
	}
}

func pumpDockerToWS(
	ctx context.Context,
	ws *websocket.Conn,
	reader io.Reader,
) {
	throttle := &lineThrottle{}
	header := make([]byte, 8)
	for {
		if _, err := io.ReadFull(reader, header); err != nil {
			return
		}
		streamID := header[0]
		size := int(header[4])<<24 | int(header[5])<<16 | int(header[6])<<8 | int(header[7])
		if size <= 0 {
			continue
		}
		payload := make([]byte, size)
		if _, err := io.ReadFull(reader, payload); err != nil {
			return
		}
		stream := "stdout"
		if streamID == 2 {
			stream = "stderr"
		}
		for _, line := range strings.Split(strings.TrimRight(string(payload), "\n"), "\n") {
			if line == "" {
				continue
			}
			if !throttle.allow() {
				if !throttle.throttled {
					throttle.throttled = true
					_ = ws.Write(ctx, websocket.MessageText, mustJSON(map[string]any{
						"type":    "console.throttled",
						"message": "Output rate limit reached; some lines dropped.",
					}))
				}
				continue
			}
			frame := mustJSON(map[string]any{
				"type":   "console.line",
				"stream": stream,
				"line":   line,
			})
			if err := ws.Write(ctx, websocket.MessageText, frame); err != nil {
				return
			}
		}
	}
}

func pumpWSToDocker(
	ctx context.Context,
	ws *websocket.Conn,
	w io.Writer,
) {
	for {
		_, data, err := ws.Read(ctx)
		if err != nil {
			return
		}
		var frame struct {
			Type    string `json:"type"`
			Command string `json:"command"`
		}
		if err := json.Unmarshal(data, &frame); err != nil {
			continue
		}
		if frame.Type != "console.command" {
			continue
		}
		if _, err := io.WriteString(w, frame.Command+"\n"); err != nil {
			return
		}
	}
}

func pumpWSToVoid(ctx context.Context, ws *websocket.Conn) {
	for {
		if _, _, err := ws.Read(ctx); err != nil {
			return
		}
	}
}

func mustJSON(v any) []byte {
	b, err := json.Marshal(v)
	if err != nil {
		// json.Marshal can't fail on map[string]any of strings + numbers
		panic(errors.New("console: marshal failed"))
	}
	return b
}

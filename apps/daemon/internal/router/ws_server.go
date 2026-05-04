package router

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/coder/websocket"

	"github.com/stellarstack/daemon/internal/docker"
	"github.com/stellarstack/daemon/internal/environment"
	"github.com/stellarstack/daemon/internal/jwt"
	"github.com/stellarstack/daemon/internal/server"
)

// filepathServerDir is the per-server bind mount root, computed off
// the daemon-wide data dir.
func filepathServerDir(uuid string) string {
	// Caller passes the WS-handler's router config indirectly; we
	// resolve via the package-level convention used everywhere else.
	return filepath.Join(serverDirRoot, "servers", uuid)
}

// serverDirRoot is set by router.New so the WS handler can construct
// per-server paths without threading config through every call site.
var serverDirRoot = "/var/lib/stellarstack"

// envelope is the wire shape every frame on the per-server WS uses.
// `event` is the discriminator; `args` carries event-specific payloads.
type envelope struct {
	Event string            `json:"event"`
	Args  []json.RawMessage `json:"args"`
}

// allowedScopes maps each `set state` action to the scope that must be
// present on the JWT. Mirrors Pelican's per-action permission model.
var setStateScope = map[string]string{
	"start":   "control.start",
	"stop":    "control.stop",
	"restart": "control.restart",
	"kill":    "control.stop",
}

// handleWS runs the per-server browser-facing WebSocket. One read pump,
// one write pump, plus a goroutine that drains the per-server event bus.
//
// JWT lifecycle:
//   - Token comes in via ?token=. Verified once on connect; daemon then
//     subscribes to the bus + replays state/history.
//   - As the token approaches expiry, daemon emits `token expiring` once
//     (60s before exp) and `token expired` at exp. The browser is
//     expected to send a fresh `auth` frame on the same socket.
func (r *Router) handleWS(w http.ResponseWriter, req *http.Request, serverUUID string) {
	token := req.URL.Query().Get("token")
	if token == "" {
		http.Error(w, "missing token", http.StatusUnauthorized)
		return
	}
	claims, err := r.verifier.Verify(token)
	if err != nil {
		http.Error(w, "invalid token: "+err.Error(), http.StatusUnauthorized)
		return
	}
	if claims.Server != serverUUID {
		http.Error(w, "token scoped to different server", http.StatusUnauthorized)
		return
	}
	if claims.Node != r.cfg.NodeID {
		http.Error(w, "token scoped to different node", http.StatusUnauthorized)
		return
	}
	if !claims.HasScope("console.read") {
		http.Error(w, "token missing console.read scope", http.StatusForbidden)
		return
	}

	conn, err := websocket.Accept(w, req, &websocket.AcceptOptions{
		OriginPatterns:  []string{"*"},
		CompressionMode: websocket.CompressionDisabled,
	})
	if err != nil {
		log.Printf("ws: accept: %v", err)
		return
	}
	defer conn.Close(websocket.StatusNormalClosure, "bye")

	ctx, cancel := context.WithCancel(req.Context())
	defer cancel()

	srv := r.manager.Get(serverUUID)
	sub := srv.Bus().Subscribe()
	defer sub.Close()

	state := &wsSession{
		claims: claims,
		mu:     sync.Mutex{},
	}

	// Initial frames: auth success, current status, then either a
	// single "marked as offline" line (no history replay when the
	// server isn't running) or the recent history buffer. Pelican-
	// shape: a refresh on an offline server shouldn't dump the entire
	// previous session's log.
	_ = writeFrame(ctx, conn, "auth success", nil)
	currentState := srv.Environment().State()
	_ = writeFrame(ctx, conn, "status", []any{string(currentState)})
	if currentState == "offline" {
		_ = writeFrame(
			ctx, conn, "console output",
			[]any{"stellarstack@" + serverUUID[:8] + "~ Server marked as offline..."},
		)
	} else {
		for _, line := range srv.History().Snapshot() {
			_ = writeFrame(ctx, conn, "console output", []any{line})
		}
	}

	// Pump bus → ws.
	go func() {
		for frame := range sub.Recv() {
			if err := conn.Write(ctx, websocket.MessageText, frame); err != nil {
				cancel()
				return
			}
		}
	}()

	// Token-expiry watchdog: emit `token expiring` 60s before exp and
	// `token expired` at exp. We don't disconnect — the browser is
	// expected to re-mint and send a fresh `auth` frame.
	go r.watchTokenExpiry(ctx, conn, state)

	// Read pump.
	for {
		_, data, err := conn.Read(ctx)
		if err != nil {
			return
		}
		var env envelope
		if err := json.Unmarshal(data, &env); err != nil {
			_ = writeFrame(ctx, conn, "daemon error", []any{"malformed frame"})
			continue
		}
		if err := r.dispatch(ctx, conn, srv, state, &env); err != nil {
			_ = writeFrame(ctx, conn, "daemon error", []any{err.Error()})
		}
	}
}

// wsSession is the per-connection mutable state: the active claims (for
// re-auth) and a guard against double-firing token-expiry warnings.
type wsSession struct {
	mu              sync.Mutex
	claims          *jwt.Claims
	expiringWarned  bool
	expiredAnnounce bool
}

func (r *Router) dispatch(ctx context.Context, conn *websocket.Conn, srv *server.Server, sess *wsSession, env *envelope) error {
	switch env.Event {
	case "auth":
		return r.handleAuth(ctx, conn, srv, sess, env)
	case "set state":
		return r.handleSetState(ctx, conn, srv, sess, env)
	case "send command":
		return r.handleSendCommand(ctx, conn, srv, sess, env)
	case "send logs":
		// Re-replay history on demand (used after a token refresh).
		for _, line := range srv.History().Snapshot() {
			_ = writeFrame(ctx, conn, "console output", []any{line})
		}
		return nil
	case "send stats":
		// Fire one immediate stats sample is non-trivial; for now this
		// is a no-op — the periodic stream resumes on its own cadence.
		return nil
	default:
		return errors.New("unknown event " + env.Event)
	}
}

func (r *Router) handleAuth(ctx context.Context, conn *websocket.Conn, srv *server.Server, sess *wsSession, env *envelope) error {
	if len(env.Args) == 0 {
		return errors.New("auth: missing token")
	}
	var token string
	if err := json.Unmarshal(env.Args[0], &token); err != nil {
		return errors.New("auth: token must be string")
	}
	claims, err := r.verifier.Verify(token)
	if err != nil {
		return err
	}
	if claims.Server != sess.claims.Server || claims.Node != sess.claims.Node {
		return errors.New("auth: token rebound to different server/node")
	}
	sess.mu.Lock()
	sess.claims = claims
	sess.expiringWarned = false
	sess.expiredAnnounce = false
	sess.mu.Unlock()
	_ = writeFrame(ctx, conn, "auth success", nil)
	return nil
}

func (r *Router) handleSetState(ctx context.Context, conn *websocket.Conn, srv *server.Server, sess *wsSession, env *envelope) error {
	if len(env.Args) == 0 {
		return errors.New("set state: missing action")
	}
	var action string
	if err := json.Unmarshal(env.Args[0], &action); err != nil {
		return errors.New("set state: action must be string")
	}
	action = strings.ToLower(action)
	scope, ok := setStateScope[action]
	if !ok {
		return errors.New("set state: unknown action")
	}
	sess.mu.Lock()
	claims := sess.claims
	sess.mu.Unlock()
	if !claims.HasScope(scope) {
		return errors.New("set state: missing scope " + scope)
	}
	go func() {
		runCtx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
		defer cancel()
		// Fresh config pull on every power action so a panel-side
		// blueprint/variable/memory change lands on the next start.
		// Stop/kill don't strictly need it but the call is cheap.
		if p := srv.Panel(); p != nil {
			cfgCtx, cfgCancel := context.WithTimeout(runCtx, 10*time.Second)
			cfg, err := p.FetchServerConfig(cfgCtx, srv.UUID())
			cfgCancel()
			if err != nil {
				log.Printf("set state %s: fetch config: %v", action, err)
				return
			}
			ports := make([]docker.PortMapping, 0, len(cfg.Ports))
			for _, p := range cfg.Ports {
				ports = append(ports, docker.PortMapping{
					HostIP:        p.HostIP,
					HostPort:      p.HostPort,
					ContainerPort: p.ContainerPort,
				})
			}
			srv.SetConfig(server.Config{
				DockerImage:    cfg.DockerImage,
				StartupCommand: cfg.StartupCommand,
				Environment:    cfg.Environment,
				Stop: environment.StopConfig{
					Type:  cfg.Stop.Type,
					Value: cfg.Stop.Value,
				},
				Memory:       cfg.MemoryLimitMb,
				CPUPercent:   cfg.CPULimitPercent,
				PortMappings: ports,
				BindMount:    filepathServerDir(srv.UUID()),
			})
		}
		if err := srv.HandlePower(runCtx, server.PowerAction(action)); err != nil {
			log.Printf("set state %s: %v", action, err)
		}
	}()
	// Best-effort audit push so the activity tab learns who triggered the
	// power action; happens out of band and does not block the response.
	if p := srv.Panel(); p != nil {
		go func(actor, act string) {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			if err := p.PushAudit(ctx, srv.UUID(), actor, "servers.power."+act, nil); err != nil {
				log.Printf("audit push: %v", err)
			}
		}(claims.Sub, action)
	}
	return nil
}

func (r *Router) handleSendCommand(ctx context.Context, conn *websocket.Conn, srv *server.Server, sess *wsSession, env *envelope) error {
	if len(env.Args) == 0 {
		return errors.New("send command: missing payload")
	}
	var line string
	if err := json.Unmarshal(env.Args[0], &line); err != nil {
		return errors.New("send command: payload must be string")
	}
	sess.mu.Lock()
	claims := sess.claims
	sess.mu.Unlock()
	if !claims.HasScope("console.write") {
		return errors.New("send command: missing console.write scope")
	}
	cmdCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	return srv.Environment().SendCommand(cmdCtx, line)
}

// watchTokenExpiry polls the active claim's exp once a second and emits
// `token expiring` / `token expired` at the appropriate boundaries. The
// browser handler is expected to refresh on `token expiring` so the
// `token expired` path only fires for stale clients.
func (r *Router) watchTokenExpiry(ctx context.Context, conn *websocket.Conn, sess *wsSession) {
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			sess.mu.Lock()
			claims := sess.claims
			expiring := sess.expiringWarned
			expired := sess.expiredAnnounce
			sess.mu.Unlock()
			if claims == nil {
				continue
			}
			now := time.Now().Unix()
			remaining := claims.Exp - now
			if remaining <= 0 && !expired {
				_ = writeFrame(ctx, conn, "token expired", nil)
				sess.mu.Lock()
				sess.expiredAnnounce = true
				sess.mu.Unlock()
				continue
			}
			if remaining > 0 && remaining <= 60 && !expiring {
				_ = writeFrame(ctx, conn, "token expiring", nil)
				sess.mu.Lock()
				sess.expiringWarned = true
				sess.mu.Unlock()
			}
		}
	}
}

func writeFrame(ctx context.Context, conn *websocket.Conn, event string, args []any) error {
	frame, err := json.Marshal(map[string]any{
		"event": event,
		"args":  args,
	})
	if err != nil {
		return err
	}
	return conn.Write(ctx, websocket.MessageText, frame)
}

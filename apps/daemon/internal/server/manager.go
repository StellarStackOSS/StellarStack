package server

import (
	"context"
	"log"
	"strings"
	"sync"

	"github.com/stellarstack/daemon/internal/docker"
	"github.com/stellarstack/daemon/internal/environment"
	"github.com/stellarstack/daemon/internal/panel"
)

// Manager owns the map of Server entries the daemon knows about and the
// reconcile-on-startup pass that aligns them with actual Docker state.
// One Manager per daemon process.
type Manager struct {
	docker        *docker.Client
	panel         *panel.Client
	historyLines  int

	mu      sync.RWMutex
	servers map[string]*Server
}

func NewManager(d *docker.Client, p *panel.Client, historyLines int) *Manager {
	return &Manager{
		docker:       d,
		panel:        p,
		historyLines: historyLines,
		servers:      map[string]*Server{},
	}
}

// Get returns the Server for uuid, creating it if not present. Used by
// the WS handler so the first hit on a previously-unseen server (post
// daemon-restart, after reconcile already created them, or for a server
// that arrived after boot via API push) lazily registers it.
func (m *Manager) Get(uuid string) *Server {
	m.mu.RLock()
	if s, ok := m.servers[uuid]; ok {
		m.mu.RUnlock()
		return s
	}
	m.mu.RUnlock()
	m.mu.Lock()
	defer m.mu.Unlock()
	if s, ok := m.servers[uuid]; ok {
		return s
	}
	s := New(uuid, m.docker, m.panel, m.historyLines)
	m.servers[uuid] = s
	return s
}

// All returns a snapshot slice of every registered server.
func (m *Manager) All() []*Server {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := make([]*Server, 0, len(m.servers))
	for _, s := range m.servers {
		out = append(out, s)
	}
	return out
}

// Reconcile runs once at startup. It lists every "stellar-*" container
// on the host, registers a Server for each, sets the state from Docker
// reality, and force-pushes the result to the API so the panel/DB
// converge after a daemon restart. No periodic reconcile loop — this
// fires once per process lifetime.
func (m *Manager) Reconcile(ctx context.Context) {
	containers, err := m.docker.ListContainersFiltered(ctx, "stellar-")
	if err != nil {
		log.Printf("manager: reconcile list: %v", err)
		return
	}
	for _, c := range containers {
		uuid := strings.TrimPrefix(c.Name, "stellar-")
		if uuid == "" || strings.HasPrefix(uuid, "install-") {
			continue
		}
		s := m.Get(uuid)
		next := environment.StateOffline
		if c.Running {
			next = environment.StateRunning
		}
		// Force, not Set: this is the only place where we want to emit
		// even when prev == next so the panel learns truth after a daemon
		// restart even when the watcher's default already matches Docker.
		s.env.ForceState(next)
		log.Printf("manager: reconcile %s -> %s", uuid, next)
	}
}

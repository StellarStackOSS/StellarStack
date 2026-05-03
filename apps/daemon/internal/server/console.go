package server

import (
	"context"
	"encoding/json"
	"io"
	"log"
	"regexp"
	"strings"
	"sync"

	"github.com/stellarstack/daemon/internal/docker"
)

// consoleHistory is the bounded ring buffer of recent stdout/stderr
// lines. Replayed to new WS subscribers on connect so they see context
// even if they joined mid-stream.
type consoleHistory struct {
	mu    sync.Mutex
	lines []string
	max   int
}

func newConsoleHistory(max int) *consoleHistory {
	if max <= 0 {
		max = 150
	}
	return &consoleHistory{max: max}
}

func (h *consoleHistory) push(line string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.lines = append(h.lines, line)
	if over := len(h.lines) - h.max; over > 0 {
		h.lines = h.lines[over:]
	}
}

// Snapshot returns a copy of the current ring contents in chronological
// order. Used by the WS handler to replay on connect.
func (h *consoleHistory) Snapshot() []string {
	h.mu.Lock()
	defer h.mu.Unlock()
	out := make([]string, len(h.lines))
	copy(out, h.lines)
	return out
}

// Reset empties the ring. Called at start so a previous container's
// logs don't bleed into a fresh run.
func (h *consoleHistory) Reset() {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.lines = h.lines[:0]
}

// ansiRE matches ANSI/VT100 escape sequences. We strip them server-side
// so the browser doesn't render them as literal characters.
var ansiRE = regexp.MustCompile(`\x1b(?:\[[0-9;?]*[A-Za-z]|[^[\x1b])`)

func cleanLine(s string) string {
	s = ansiRE.ReplaceAllString(s, "")
	if i := strings.LastIndex(s, "\r"); i >= 0 {
		s = s[i+1:]
	}
	return strings.TrimRight(s, " \t")
}

// startAttachPump opens a follow-logs stream and pushes each line into
// the bus + history. Idempotent: a second call cancels the first.
func (s *Server) startAttachPump() {
	s.attachMu.Lock()
	defer s.attachMu.Unlock()
	if s.attachCancel != nil {
		s.attachCancel()
	}
	ctx, cancel := context.WithCancel(context.Background())
	s.attachCancel = cancel
	go s.runAttachPump(ctx)
}

func (s *Server) stopAttachPump() {
	s.attachMu.Lock()
	defer s.attachMu.Unlock()
	if s.attachCancel != nil {
		s.attachCancel()
		s.attachCancel = nil
	}
}

func (s *Server) runAttachPump(ctx context.Context) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("server %s: attach pump panic: %v", s.uuid, r)
		}
	}()
	dc := s.env.Docker()
	containerName := s.env.ContainerName()
	for {
		if ctx.Err() != nil {
			return
		}
		stream, err := dc.FollowLogs(ctx, containerName)
		if err != nil {
			// Container may not be up yet (race between MarkRunning and
			// Docker actually attaching the log stream). Retry briefly.
			if !sleepOrDone(ctx, 1) {
				return
			}
			continue
		}
		for line := range stream {
			cleaned := cleanLine(line.Line)
			if cleaned == "" {
				continue
			}
			s.history.push(cleaned)
			frame, _ := json.Marshal(map[string]any{
				"event": "console output",
				"args":  []any{cleaned},
			})
			s.bus.Publish(frame)
		}
		// Stream closed (container exited or transient error). If the
		// container is gone, watchExit handles state. Otherwise loop and
		// retry.
		if !sleepOrDone(ctx, 1) {
			return
		}
	}
}

// sleepOrDone returns false when ctx is cancelled. Used to avoid tight
// retry loops when the container is briefly unreachable.
func sleepOrDone(ctx context.Context, seconds int) bool {
	select {
	case <-ctx.Done():
		return false
	case <-timeAfter(seconds):
		return true
	}
}

// drainReader is unused but kept for the rare case we want one-shot log
// reads (install path).
func drainReader(r io.Reader) {
	_, _ = io.Copy(io.Discard, r)
}

// containerAttacher exists so tests can fake out Docker for the pump.
type containerAttacher interface {
	FollowLogs(ctx context.Context, name string) (<-chan docker.LogLine, error)
}

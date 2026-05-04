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
	// Trim trailing CR first — it's just the line terminator from
	// `\r\n` after splitting on `\n` and shouldn't be treated as a
	// cursor-overwrite. Without this, a line that ended `…\r\n` would
	// have its entire content wiped by the LastIndex("\r") logic.
	s = strings.TrimRight(s, "\r")
	// Any *interior* CR is a real cursor reset (progress bars, `[K`
	// clears) — keep only the last segment, what a terminal would
	// have rendered.
	if i := strings.LastIndex(s, "\r"); i >= 0 {
		s = s[i+1:]
	}
	return strings.TrimRight(s, " \t")
}

// startAttachPump is the reconcile-side fallback for surfaces where
// the container is already running and we never opened a pre-start
// attach (daemon restart while server was up). No-op when an attach
// stream is already active so doStart's pre-start attach can't be
// double-consumed.
func (s *Server) startAttachPump() {
	s.attachMu.Lock()
	defer s.attachMu.Unlock()
	if s.attachCancel != nil {
		// Already pumping (pre-start attach owns the stream).
		return
	}
	ctx, cancel := context.WithCancel(context.Background())
	s.attachCancel = cancel
	go s.runAttachPump(ctx)
}

// startAttachStream takes ownership of an already-attached docker
// stream (opened before StartContainer) and pumps lines through the
// bus + history. Mirrors Pelican wings: ScanReader on the attach
// stream's stdout/stderr until EOF or context cancel.
func (s *Server) startAttachStream(reader io.Reader, tty bool, closer func()) {
	s.attachMu.Lock()
	defer s.attachMu.Unlock()
	if s.attachCancel != nil {
		s.attachCancel()
	}
	ctx, cancel := context.WithCancel(context.Background())
	s.attachCancel = cancel
	go func() {
		s.runAttachStream(ctx, reader, tty, closer)
		// Clear attachCancel when the stream ends so a future running
		// transition can spawn a fresh pump.
		s.attachMu.Lock()
		if s.attachCancel != nil {
			cancelFn := s.attachCancel
			s.attachCancel = nil
			s.attachMu.Unlock()
			_ = cancelFn // already returned; exists only for symmetry
			return
		}
		s.attachMu.Unlock()
	}()
}

func (s *Server) runAttachStream(ctx context.Context, reader io.Reader, tty bool, closer func()) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("server %s: attach stream panic: %v", s.uuid, r)
		}
	}()
	defer closer()
	log.Printf("server %s: attach stream start (tty=%v)", s.uuid, tty)
	out := make(chan docker.LogLine, 64)
	go func() {
		defer close(out)
		if tty {
			docker.StreamRawLines(ctx, reader, out)
		} else {
			docker.StreamMultiplexedLines(ctx, reader, out)
		}
	}()
	count := 0
	for line := range out {
		cleaned := cleanLine(line.Line)
		if cleaned == "" {
			continue
		}
		count++
		s.history.push(cleaned)
		frame, _ := json.Marshal(map[string]any{
			"event": "console output",
			"args":  []any{cleaned},
		})
		s.bus.Publish(frame)
	}
	log.Printf("server %s: attach stream end (lines=%d ctx=%v)", s.uuid, count, ctx.Err())
}

func (s *Server) stopAttachPump() {
	s.attachMu.Lock()
	defer s.attachMu.Unlock()
	if s.attachCancel != nil {
		s.attachCancel()
		s.attachCancel = nil
	}
}

// SnapshotLogs pulls the last `tail` lines from the docker log buffer
// synchronously and pushes them through the bus + history. Used on
// state transitions where the streaming pump may not have caught the
// final output (e.g. container exits in <1s after start before the
// pump's first FollowLogs call returns). Idempotent — pushing the
// same line twice just means the browser sees a duplicate.
func (s *Server) SnapshotLogs(ctx context.Context, tail int) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("server %s: snapshot panic: %v", s.uuid, r)
		}
	}()
	dc := s.env.Docker()
	rd, err := dc.Logs(ctx, s.env.ContainerName(), tail)
	if err != nil {
		return
	}
	defer rd.Close()
	tty := false
	if cfg, err := dc.InspectConfigTTY(ctx, s.env.ContainerName()); err == nil {
		tty = cfg
	}
	out := make(chan docker.LogLine, 64)
	go func() {
		defer close(out)
		if tty {
			docker.StreamRawLines(ctx, rd, out)
		} else {
			docker.StreamMultiplexedLines(ctx, rd, out)
		}
	}()
	for line := range out {
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
}

func (s *Server) runAttachPump(ctx context.Context) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("server %s: attach pump panic: %v", s.uuid, r)
		}
	}()
	dc := s.env.Docker()
	containerName := s.env.ContainerName()
	log.Printf("server %s: attach pump start", s.uuid)
	defer log.Printf("server %s: attach pump exit (ctx err=%v)", s.uuid, ctx.Err())
	lineCount := 0
	for {
		if ctx.Err() != nil {
			return
		}
		stream, err := dc.FollowLogs(ctx, containerName)
		if err != nil {
			log.Printf("server %s: follow logs: %v", s.uuid, err)
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
			lineCount++
			s.history.push(cleaned)
			frame, _ := json.Marshal(map[string]any{
				"event": "console output",
				"args":  []any{cleaned},
			})
			s.bus.Publish(frame)
		}
		log.Printf("server %s: log stream closed (read %d lines)", s.uuid, lineCount)
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

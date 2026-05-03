package server

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/stellarstack/daemon/internal/environment"
)

// startStatsPump opens a Docker stats stream and republishes each frame
// over the bus. Idempotent.
func (s *Server) startStatsPump() {
	s.statsMu.Lock()
	defer s.statsMu.Unlock()
	if s.statsCancel != nil {
		s.statsCancel()
	}
	ctx, cancel := context.WithCancel(context.Background())
	s.statsCancel = cancel
	go s.runStatsPump(ctx)
}

func (s *Server) stopStatsPump() {
	s.statsMu.Lock()
	defer s.statsMu.Unlock()
	if s.statsCancel != nil {
		s.statsCancel()
		s.statsCancel = nil
	}
}

func (s *Server) runStatsPump(ctx context.Context) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("server %s: stats pump panic: %v", s.uuid, r)
		}
	}()
	dc := s.env.Docker()
	containerName := s.env.ContainerName()
	stream, err := dc.StatsStream(ctx, containerName)
	if err != nil {
		log.Printf("server %s: stats stream: %v", s.uuid, err)
		return
	}
	for snap := range stream {
		s.statsMu.Lock()
		started := s.startedAt
		s.statsMu.Unlock()
		var uptime int64
		if !started.IsZero() {
			uptime = time.Since(started).Milliseconds()
		}
		frame, _ := json.Marshal(map[string]any{
			"event": "stats",
			"args": []any{
				map[string]any{
					"memory_bytes":       snap.MemoryBytes,
					"memory_limit_bytes": snap.MemoryLimitBytes,
					"cpu_absolute":       snap.CPUAbsolute,
					"network": map[string]any{
						"rx_bytes": snap.NetworkRxBytes,
						"tx_bytes": snap.NetworkTxBytes,
					},
					"disk_bytes":       int64(0), // populated by a separate path; 0 is acceptable
					"disk_read_bytes":  snap.DiskReadBytes,
					"disk_write_bytes": snap.DiskWriteBytes,
					"uptime_ms":        uptime,
					"state":            string(s.env.State()),
				},
			},
		})
		s.bus.Publish(frame)
	}
}

// timeAfter is a thin wrapper so tests can stub time.After. Used by the
// console pump too.
func timeAfter(seconds int) <-chan time.Time {
	return time.After(time.Duration(seconds) * time.Second)
}

var _ = environment.StateRunning // keep import even if used only via env field

// Package docker is a small focused HTTP client for the Docker Engine
// API. We don't pull in moby/docker-cli because we only need a handful of
// container operations (create, start, stop, kill, wait, attach, logs,
// stats, inspect) and the dependency tree of the official SDK is large
// and slow to build.
package docker

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

// API version matches what's stable on Docker Engine 25+ (Colima ships
// 25 by default). Pinning avoids "no such endpoint" surprises after
// upgrades; v1.44 is the floor recent Docker daemons accept.
const apiVersion = "v1.44"

// Client is a thin wrapper that dials the Docker socket and parses JSON
// responses. Concurrent calls are safe; each round trip dials a fresh
// connection so attach/wait calls can stream without blocking others.
type Client struct {
	socketPath string
	httpClient *http.Client
}

// New returns a Client bound to the supplied unix socket path.
func New(socketPath string) *Client {
	return &Client{
		socketPath: socketPath,
		httpClient: &http.Client{
			// No global timeout because attach + logs are long-lived;
			// per-request contexts handle cancellation.
			Transport: &http.Transport{
				DialContext: func(ctx context.Context, _ string, _ string) (net.Conn, error) {
					var d net.Dialer
					return d.DialContext(ctx, "unix", socketPath)
				},
			},
		},
	}
}

// do executes a request against the Docker socket. The path is the API
// path (without /vN.M); the version is prefixed automatically.
func (c *Client) do(ctx context.Context, method, path string, body io.Reader) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, method, "http://docker/"+apiVersion+path, body)
	if err != nil {
		return nil, err
	}
	req.Host = "docker"
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	return c.httpClient.Do(req)
}

func (c *Client) doJSON(ctx context.Context, method, path string, body any) (*http.Response, error) {
	var reader io.Reader
	if body != nil {
		buf, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		reader = bytes.NewReader(buf)
	}
	return c.do(ctx, method, path, reader)
}

func errorFromResponse(r *http.Response, op string) error {
	defer r.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(r.Body, 4096))
	msg := strings.TrimSpace(string(body))
	if msg == "" {
		msg = r.Status
	}
	return fmt.Errorf("docker %s: %s", op, msg)
}

// ContainerNotFoundError is returned when an inspect/wait/kill targets a
// container the daemon has already removed.
type ContainerNotFoundError struct{ Name string }

func (e *ContainerNotFoundError) Error() string { return "container not found: " + e.Name }

// PortMapping describes a host:container port pair.
type PortMapping struct {
	HostIP        string
	HostPort      int
	ContainerPort int
}

// CreateContainerOptions is the (partial) Docker create payload we use.
// We don't expose every field — only what the install/start path needs.
type CreateContainerOptions struct {
	Name             string
	Image            string
	Env              map[string]string
	StopSignal       string
	BindMount        string // mounted at /home/container
	MemoryLimitBytes int64
	CPULimitPercent  int64
	PidsLimit        int64
	Ports            []PortMapping
	Cmd              []string
	Entrypoint       []string
	WorkingDir       string
	OpenStdin        bool
	Tty              bool
	NetworkMode      string
	AutoRemove       bool
	User             string
}

// CreateContainer creates a new container and returns its id. Idempotent
// callers should `RemoveContainer(force=true)` first; this method does
// not handle name conflicts itself.
func (c *Client) CreateContainer(ctx context.Context, opts CreateContainerOptions) (string, error) {
	envSlice := make([]string, 0, len(opts.Env))
	for k, v := range opts.Env {
		envSlice = append(envSlice, k+"="+v)
	}
	exposed := map[string]struct{}{}
	bindings := map[string][]map[string]string{}
	for _, p := range opts.Ports {
		key := fmt.Sprintf("%d/tcp", p.ContainerPort)
		exposed[key] = struct{}{}
		host := p.HostIP
		if host == "" {
			host = "0.0.0.0"
		}
		bindings[key] = append(bindings[key], map[string]string{
			"HostIp":   host,
			"HostPort": fmt.Sprintf("%d", p.HostPort),
		})
	}
	hostConfig := map[string]any{
		"PortBindings": bindings,
		"Memory":       opts.MemoryLimitBytes,
		"PidsLimit":    opts.PidsLimit,
		"AutoRemove":   opts.AutoRemove,
	}
	if opts.CPULimitPercent > 0 {
		// Translate "percent" to CFS quota / period. 100ms period; quota
		// = percent * 1ms. So 100% = 100_000us quota.
		hostConfig["CpuPeriod"] = 100_000
		hostConfig["CpuQuota"] = opts.CPULimitPercent * 1000
	}
	if opts.BindMount != "" {
		hostConfig["Binds"] = []string{opts.BindMount + ":/home/container"}
	}
	if opts.NetworkMode != "" {
		hostConfig["NetworkMode"] = opts.NetworkMode
	}

	body := map[string]any{
		"Image":        opts.Image,
		"Env":          envSlice,
		"ExposedPorts": exposed,
		"HostConfig":   hostConfig,
		"OpenStdin":    opts.OpenStdin,
		"Tty":          opts.Tty,
		"AttachStdin":  opts.OpenStdin,
		"AttachStdout": true,
		"AttachStderr": true,
		"StdinOnce":    false,
	}
	if opts.StopSignal != "" {
		body["StopSignal"] = opts.StopSignal
	}
	if len(opts.Cmd) > 0 {
		body["Cmd"] = opts.Cmd
	}
	if len(opts.Entrypoint) > 0 {
		body["Entrypoint"] = opts.Entrypoint
	}
	if opts.WorkingDir != "" {
		body["WorkingDir"] = opts.WorkingDir
	}
	if opts.User != "" {
		body["User"] = opts.User
	}

	q := url.Values{}
	q.Set("name", opts.Name)
	resp, err := c.doJSON(ctx, http.MethodPost, "/containers/create?"+q.Encode(), body)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		return "", errorFromResponse(resp, "create")
	}
	var out struct{ Id string }
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", err
	}
	return out.Id, nil
}

// StartContainer issues a `POST /containers/:name/start`. Returns nil on
// success; never blocks waiting for readiness.
func (c *Client) StartContainer(ctx context.Context, name string) error {
	resp, err := c.do(ctx, http.MethodPost, "/containers/"+name+"/start", nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotModified {
		return nil
	}
	if resp.StatusCode/100 != 2 {
		return errorFromResponse(resp, "start")
	}
	return nil
}

// StopContainer issues a graceful stop with the supplied grace period
// (seconds). Docker sends StopSignal then SIGKILL after the grace.
func (c *Client) StopContainer(ctx context.Context, name string, graceSeconds int) error {
	q := url.Values{}
	q.Set("t", fmt.Sprintf("%d", graceSeconds))
	resp, err := c.do(ctx, http.MethodPost, "/containers/"+name+"/stop?"+q.Encode(), nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return &ContainerNotFoundError{Name: name}
	}
	if resp.StatusCode == http.StatusNotModified {
		return nil
	}
	if resp.StatusCode/100 != 2 {
		return errorFromResponse(resp, "stop")
	}
	return nil
}

// KillContainer sends the named signal (e.g. "SIGKILL", "SIGTERM").
func (c *Client) KillContainer(ctx context.Context, name, signal string) error {
	q := url.Values{}
	if signal != "" {
		q.Set("signal", signal)
	}
	resp, err := c.do(ctx, http.MethodPost, "/containers/"+name+"/kill?"+q.Encode(), nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return &ContainerNotFoundError{Name: name}
	}
	if resp.StatusCode == http.StatusConflict {
		// "Container is not running" — treat as already stopped.
		return nil
	}
	if resp.StatusCode/100 != 2 {
		return errorFromResponse(resp, "kill")
	}
	return nil
}

// RemoveContainer deletes the container. Pass force=true to remove a
// running one.
func (c *Client) RemoveContainer(ctx context.Context, name string, force bool) error {
	q := url.Values{}
	if force {
		q.Set("force", "true")
	}
	q.Set("v", "true")
	resp, err := c.do(ctx, http.MethodDelete, "/containers/"+name+"?"+q.Encode(), nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return nil
	}
	if resp.StatusCode/100 != 2 {
		return errorFromResponse(resp, "remove")
	}
	return nil
}

// InspectState reports the container's running flag, exit code, started-at
// timestamp, and OOM flag. Returns ContainerNotFoundError when missing.
type State struct {
	Running    bool
	ExitCode   int
	OOMKilled  bool
	StartedAt  string
	StopSignal string
}

// Inspect returns container state plus the configured StopSignal.
func (c *Client) Inspect(ctx context.Context, name string) (*State, error) {
	resp, err := c.do(ctx, http.MethodGet, "/containers/"+name+"/json", nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return nil, &ContainerNotFoundError{Name: name}
	}
	if resp.StatusCode/100 != 2 {
		return nil, errorFromResponse(resp, "inspect")
	}
	var raw struct {
		State struct {
			Running   bool
			ExitCode  int
			OOMKilled bool
			StartedAt string
		}
		Config struct {
			StopSignal string
		}
	}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, err
	}
	return &State{
		Running:    raw.State.Running,
		ExitCode:   raw.State.ExitCode,
		OOMKilled:  raw.State.OOMKilled,
		StartedAt:  raw.State.StartedAt,
		StopSignal: raw.Config.StopSignal,
	}, nil
}

// IsRunning is a convenience wrapper. Returns false on any error so
// callers don't need to distinguish "missing" from "stopped".
func (c *Client) IsRunning(ctx context.Context, name string) bool {
	st, err := c.Inspect(ctx, name)
	if err != nil {
		return false
	}
	return st.Running
}

// WaitNotRunning blocks on Docker's `/containers/:name/wait?condition=
// not-running` endpoint until the container exits or the context is
// cancelled. Returns true on exit, false on context cancel.
func (c *Client) WaitNotRunning(ctx context.Context, name string) bool {
	resp, err := c.do(ctx, http.MethodPost, "/containers/"+name+"/wait?condition=not-running", nil)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode/100 == 2
}

// EnsureImage pulls the image if it's not already present locally.
func (c *Client) EnsureImage(ctx context.Context, image string) error {
	// Check first via /images/:name/json — cheap.
	resp, err := c.do(ctx, http.MethodGet, "/images/"+url.PathEscape(image)+"/json", nil)
	if err == nil && resp.StatusCode == http.StatusOK {
		resp.Body.Close()
		return nil
	}
	if resp != nil {
		resp.Body.Close()
	}
	// Pull.
	q := url.Values{}
	q.Set("fromImage", image)
	pull, err := c.do(ctx, http.MethodPost, "/images/create?"+q.Encode(), nil)
	if err != nil {
		return err
	}
	defer pull.Body.Close()
	if pull.StatusCode/100 != 2 {
		return errorFromResponse(pull, "pull")
	}
	// Drain the streamed pull progress so the docker daemon completes.
	_, _ = io.Copy(io.Discard, pull.Body)
	return nil
}

// AttachOptions configures an attach session.
type AttachOptions struct {
	Stdin  bool
	Stdout bool
	Stderr bool
	Stream bool
	Logs   bool
}

// Attach opens a hijacked TCP connection to the container's stdio. The
// caller must read multiplexed frames in the standard 8-byte-header
// format (stdout=1, stderr=2). Closing conn closes the stream.
func (c *Client) Attach(ctx context.Context, name string, opts AttachOptions) (net.Conn, *bufio.Reader, error) {
	q := url.Values{}
	if opts.Stream {
		q.Set("stream", "1")
	}
	if opts.Stdin {
		q.Set("stdin", "1")
	}
	if opts.Stdout {
		q.Set("stdout", "1")
	}
	if opts.Stderr {
		q.Set("stderr", "1")
	}
	if opts.Logs {
		q.Set("logs", "1")
	}

	conn, err := net.Dial("unix", c.socketPath)
	if err != nil {
		return nil, nil, fmt.Errorf("dial docker: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "http://docker/"+apiVersion+"/containers/"+name+"/attach?"+q.Encode(), nil)
	if err != nil {
		conn.Close()
		return nil, nil, err
	}
	req.Host = "docker"
	req.Header.Set("Connection", "Upgrade")
	req.Header.Set("Upgrade", "tcp")
	if err := req.Write(conn); err != nil {
		conn.Close()
		return nil, nil, fmt.Errorf("attach request: %w", err)
	}
	reader := bufio.NewReader(conn)
	resp, err := http.ReadResponse(reader, req)
	if err != nil {
		conn.Close()
		return nil, nil, fmt.Errorf("attach response: %w", err)
	}
	if resp.StatusCode != http.StatusSwitchingProtocols && resp.StatusCode/100 != 2 {
		conn.Close()
		return nil, nil, fmt.Errorf("attach: %s", resp.Status)
	}
	return conn, reader, nil
}

// Logs fetches the container's accumulated stdout+stderr buffer (one-shot,
// no follow). Returns nil reader if the container is missing.
func (c *Client) Logs(ctx context.Context, name string, tail int) (io.ReadCloser, error) {
	q := url.Values{}
	q.Set("stdout", "1")
	q.Set("stderr", "1")
	if tail > 0 {
		q.Set("tail", fmt.Sprintf("%d", tail))
	}
	resp, err := c.do(ctx, http.MethodGet, "/containers/"+name+"/logs?"+q.Encode(), nil)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode == http.StatusNotFound {
		resp.Body.Close()
		return nil, &ContainerNotFoundError{Name: name}
	}
	if resp.StatusCode/100 != 2 {
		return nil, errorFromResponse(resp, "logs")
	}
	return resp.Body, nil
}

// FollowLogs streams stdout+stderr forever. The returned channel closes
// when the stream ends or context is cancelled.
type LogLine struct {
	Stream string // "stdout" | "stderr"
	Line   string
}

// FollowLogs streams container stdout+stderr forever. Auto-detects
// TTY-mode by inspecting the container first: TTY containers return a
// raw byte stream; non-TTY containers use Docker's 8-byte-header
// multiplexed format. Pelican-style yolks images run with TTY=true so
// the entrypoint can render its prompt with ANSI escapes.
func (c *Client) FollowLogs(ctx context.Context, name string) (<-chan LogLine, error) {
	tty := false
	if cfg, err := c.inspectConfigTty(ctx, name); err == nil {
		tty = cfg
	}
	q := url.Values{}
	q.Set("stdout", "1")
	q.Set("stderr", "1")
	q.Set("follow", "1")
	// Pull the last 200 lines on attach so a freshly-connected pump
	// (post-daemon-restart, post-reconcile) surfaces recent boot output
	// instead of waiting for the next line the container happens to
	// emit. Pelican does the same.
	q.Set("tail", "200")
	resp, err := c.do(ctx, http.MethodGet, "/containers/"+name+"/logs?"+q.Encode(), nil)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode == http.StatusNotFound {
		resp.Body.Close()
		return nil, &ContainerNotFoundError{Name: name}
	}
	if resp.StatusCode/100 != 2 {
		return nil, errorFromResponse(resp, "follow logs")
	}
	out := make(chan LogLine, 32)
	go func() {
		defer close(out)
		defer resp.Body.Close()
		if tty {
			streamRawLines(ctx, resp.Body, out)
			return
		}
		streamMultiplexedLines(ctx, resp.Body, out)
	}()
	return out, nil
}

// InspectConfigTTY is the exported sibling of inspectConfigTty so the
// server package can reuse the same lookup when doing one-shot log
// snapshots without re-doing the parser plumbing.
func (c *Client) InspectConfigTTY(ctx context.Context, name string) (bool, error) {
	return c.inspectConfigTty(ctx, name)
}

// StreamRawLines is the exported sibling of streamRawLines so callers
// outside this package (snapshot reads in server/console.go) can
// dispatch on the right parser when a one-shot Logs read is in flight.
func StreamRawLines(ctx context.Context, r io.Reader, out chan<- LogLine) {
	streamRawLines(ctx, r, out)
}

// StreamMultiplexedLines mirrors StreamRawLines for non-TTY containers.
func StreamMultiplexedLines(ctx context.Context, r io.Reader, out chan<- LogLine) {
	streamMultiplexedLines(ctx, r, out)
}

// inspectConfigTty fetches the container's Config.Tty without
// pulling the rest of the inspect payload through Inspect (which
// trims the field). Best-effort; failures default to non-TTY.
func (c *Client) inspectConfigTty(ctx context.Context, name string) (bool, error) {
	resp, err := c.do(ctx, http.MethodGet, "/containers/"+name+"/json", nil)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		return false, errorFromResponse(resp, "inspect tty")
	}
	var raw struct {
		Config struct {
			Tty bool
		}
	}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return false, err
	}
	return raw.Config.Tty, nil
}

func streamMultiplexedLines(ctx context.Context, r io.Reader, out chan<- LogLine) {
	header := make([]byte, 8)
	for {
		if _, err := io.ReadFull(r, header); err != nil {
			return
		}
		size := int(uint32(header[4])<<24 | uint32(header[5])<<16 | uint32(header[6])<<8 | uint32(header[7]))
		if size <= 0 {
			continue
		}
		payload := make([]byte, size)
		if _, err := io.ReadFull(r, payload); err != nil {
			return
		}
		stream := "stdout"
		if header[0] == 2 {
			stream = "stderr"
		}
		for _, line := range strings.Split(strings.TrimRight(string(payload), "\n"), "\n") {
			select {
			case <-ctx.Done():
				return
			case out <- LogLine{Stream: stream, Line: line}:
			}
		}
	}
}

func streamRawLines(ctx context.Context, r io.Reader, out chan<- LogLine) {
	buf := make([]byte, 8192)
	leftover := ""
	for {
		n, err := r.Read(buf)
		if n > 0 {
			data := leftover + string(buf[:n])
			lastNL := strings.LastIndex(data, "\n")
			if lastNL < 0 {
				leftover = data
			} else {
				chunk := data[:lastNL]
				leftover = data[lastNL+1:]
				for _, line := range strings.Split(chunk, "\n") {
					if line == "" {
						continue
					}
					select {
					case <-ctx.Done():
						return
					case out <- LogLine{Stream: "stdout", Line: line}:
					}
				}
			}
		}
		if err != nil {
			return
		}
	}
}

// StatsSnapshot is the parsed sample we emit on the WS stats event. cpu
// is computed as the delta between this and the previous snapshot.
type StatsSnapshot struct {
	MemoryBytes      int64
	MemoryLimitBytes int64
	CPUAbsolute      float64 // Pelican-style: (cpu_delta / system_delta) * num_online_cpus
	NetworkRxBytes   int64
	NetworkTxBytes   int64
	DiskReadBytes    int64
	DiskWriteBytes   int64
}

type rawStats struct {
	CPUStats struct {
		CPUUsage struct {
			TotalUsage  uint64 `json:"total_usage"`
			PercpuUsage []uint64
		} `json:"cpu_usage"`
		SystemUsage uint64 `json:"system_cpu_usage"`
		OnlineCPUs  uint32 `json:"online_cpus"`
	} `json:"cpu_stats"`
	PreCPUStats struct {
		CPUUsage struct {
			TotalUsage uint64 `json:"total_usage"`
		} `json:"cpu_usage"`
		SystemUsage uint64 `json:"system_cpu_usage"`
		OnlineCPUs  uint32 `json:"online_cpus"`
	} `json:"precpu_stats"`
	MemoryStats struct {
		Usage uint64
		Limit uint64
		Stats struct {
			Cache uint64
		}
	} `json:"memory_stats"`
	Networks map[string]struct {
		RxBytes uint64 `json:"rx_bytes"`
		TxBytes uint64 `json:"tx_bytes"`
	} `json:"networks"`
	BlkioStats struct {
		IOServiceBytesRecursive []struct {
			Op    string
			Value uint64
		} `json:"io_service_bytes_recursive"`
	} `json:"blkio_stats"`
}

// StatsStream returns a channel that receives one StatsSnapshot per
// Docker stats frame (~every second). The channel closes when ctx is
// cancelled or the stream errors.
func (c *Client) StatsStream(ctx context.Context, name string) (<-chan StatsSnapshot, error) {
	q := url.Values{}
	q.Set("stream", "1")
	q.Set("one-shot", "0")
	resp, err := c.do(ctx, http.MethodGet, "/containers/"+name+"/stats?"+q.Encode(), nil)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode == http.StatusNotFound {
		resp.Body.Close()
		return nil, &ContainerNotFoundError{Name: name}
	}
	if resp.StatusCode/100 != 2 {
		return nil, errorFromResponse(resp, "stats")
	}
	out := make(chan StatsSnapshot, 4)
	go func() {
		defer close(out)
		defer resp.Body.Close()
		dec := json.NewDecoder(resp.Body)
		for {
			var s rawStats
			if err := dec.Decode(&s); err != nil {
				return
			}
			snap := convertStats(s)
			select {
			case <-ctx.Done():
				return
			case out <- snap:
			}
		}
	}()
	return out, nil
}

func convertStats(s rawStats) StatsSnapshot {
	memUsed := int64(s.MemoryStats.Usage) - int64(s.MemoryStats.Stats.Cache)
	if memUsed < 0 {
		memUsed = int64(s.MemoryStats.Usage)
	}
	var cpu float64
	cpuDelta := float64(s.CPUStats.CPUUsage.TotalUsage) - float64(s.PreCPUStats.CPUUsage.TotalUsage)
	sysDelta := float64(s.CPUStats.SystemUsage) - float64(s.PreCPUStats.SystemUsage)
	if cpuDelta > 0 && sysDelta > 0 {
		cpus := float64(s.CPUStats.OnlineCPUs)
		if cpus == 0 {
			cpus = float64(len(s.CPUStats.CPUUsage.PercpuUsage))
		}
		if cpus == 0 {
			cpus = 1
		}
		cpu = (cpuDelta / sysDelta) * cpus * 100.0
	}
	var rx, tx int64
	for _, n := range s.Networks {
		rx += int64(n.RxBytes)
		tx += int64(n.TxBytes)
	}
	var rd, wr int64
	for _, e := range s.BlkioStats.IOServiceBytesRecursive {
		switch strings.ToLower(e.Op) {
		case "read":
			rd += int64(e.Value)
		case "write":
			wr += int64(e.Value)
		}
	}
	return StatsSnapshot{
		MemoryBytes:      memUsed,
		MemoryLimitBytes: int64(s.MemoryStats.Limit),
		CPUAbsolute:      cpu,
		NetworkRxBytes:   rx,
		NetworkTxBytes:   tx,
		DiskReadBytes:    rd,
		DiskWriteBytes:   wr,
	}
}

// ListContainersFiltered returns every container whose name matches the
// supplied prefix. Used by Reconcile on startup to discover stellar-*
// containers without enumerating the entire host.
type ContainerSummary struct {
	ID      string
	Name    string
	Running bool
}

func (c *Client) ListContainersFiltered(ctx context.Context, namePrefix string) ([]ContainerSummary, error) {
	q := url.Values{}
	q.Set("all", "1")
	resp, err := c.do(ctx, http.MethodGet, "/containers/json?"+q.Encode(), nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		return nil, errorFromResponse(resp, "list")
	}
	var raw []struct {
		Id    string
		Names []string
		State string
	}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, err
	}
	out := make([]ContainerSummary, 0, len(raw))
	for _, r := range raw {
		for _, n := range r.Names {
			n = strings.TrimPrefix(n, "/")
			if !strings.HasPrefix(n, namePrefix) {
				continue
			}
			out = append(out, ContainerSummary{
				ID:      r.Id,
				Name:    n,
				Running: strings.EqualFold(r.State, "running"),
			})
			break
		}
	}
	return out, nil
}

// errPipeClosed is returned by AttachWriter when the underlying conn has
// been closed. Used so callers can distinguish from normal write errors.
var errPipeClosed = errors.New("attach pipe closed")

// LockedConn wraps a net.Conn with a mutex so concurrent writers from
// multiple goroutines don't interleave bytes mid-frame. Used by the
// console WS write pump.
type LockedConn struct {
	mu   sync.Mutex
	conn net.Conn
}

func NewLockedConn(c net.Conn) *LockedConn { return &LockedConn{conn: c} }

func (l *LockedConn) Write(b []byte) (int, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.conn == nil {
		return 0, errPipeClosed
	}
	return l.conn.Write(b)
}

func (l *LockedConn) Close() error {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.conn == nil {
		return nil
	}
	err := l.conn.Close()
	l.conn = nil
	return err
}

// SetDeadline lets call sites enforce a write timeout without holding the
// mutex (the underlying conn handles concurrent SetDeadline safely).
func (l *LockedConn) SetDeadline(t time.Time) error {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.conn == nil {
		return errPipeClosed
	}
	return l.conn.SetDeadline(t)
}

// Package docker wraps the small subset of Docker Engine API operations the
// daemon performs: ensure image, create container with HostConfig, run a
// one-shot install container, and stream container logs.
//
// Implemented against the Docker Engine HTTP API directly (over the unix
// socket) so the daemon binary stays small and we don't pull in the full
// docker/docker SDK + go-connections + sirupsen/logrus tree.
package docker

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync/atomic"
	"time"
)

const apiVersion = "v1.47"

// ansiRE matches ANSI/VT100 escape sequences for stripping before display.
var ansiRE = regexp.MustCompile(`\x1b(?:\[[0-9;?]*[A-Za-z]|[^[\x1b])`)

// cleanLogLine strips ANSI escape sequences and handles bare carriage returns
// so progress-bar output ("100%\r") collapses to just the final value.
func cleanLogLine(raw string) string {
	s := ansiRE.ReplaceAllString(raw, "")
	if idx := strings.LastIndex(s, "\r"); idx >= 0 {
		s = s[idx+1:]
	}
	return strings.TrimRight(s, " \t")
}

// Client talks to the Docker daemon over the unix socket.
type Client struct {
	socketPath string
	httpClient *http.Client
}

// New returns a Client connected to /var/run/docker.sock by default.
// `socketPath` may be overridden for tests or non-default Docker hosts.
func New(socketPath string) *Client {
	if socketPath == "" {
		socketPath = "/var/run/docker.sock"
	}
	transport := &http.Transport{
		DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
			d := net.Dialer{}
			return d.DialContext(ctx, "unix", socketPath)
		},
	}
	return &Client{
		socketPath: socketPath,
		httpClient: &http.Client{Transport: transport},
	}
}

// EnsureImage ensures the image is available locally. If the image is already
// present it is used as-is (no registry round-trip). Pull is only attempted
// when the image is missing locally, and a failed pull still succeeds if the
// image was found in a previous check (registry outage fallback).
func (c *Client) EnsureImage(ctx context.Context, image string) error {
	if found, err := c.imageExists(ctx, image); err == nil && found {
		return nil
	}
	if err := c.pullImage(ctx, image); err != nil {
		if found, listErr := c.imageExists(ctx, image); listErr == nil && found {
			return nil
		}
		return fmt.Errorf("pull image %q: %w", image, err)
	}
	return nil
}

// CreateContainerOptions describes everything the daemon supplies when
// creating a server container. `Name` becomes the Docker container name;
// `BindMount` is the host path mounted at /home/container.
type CreateContainerOptions struct {
	Name             string
	Image            string
	Env              map[string]string
	StopSignal       string
	BindMount        string
	MemoryLimitBytes int64
	CPULimitPercent  int64
	PidsLimit        int64
	Ports            map[string]string
	DropCapabilities []string // defaults applied internally if nil
}

// memoryWithOverhead adds a headroom buffer on top of the configured limit so
// the JVM and system processes don't get OOM-killed the instant the heap fills.
// Mirrors Pelican Wings' behaviour: <2 GB → +15%, 2–4 GB → +10%, ≥4 GB → +5%.
func memoryWithOverhead(limitBytes int64) int64 {
	const (
		gb2 = 2 * 1024 * 1024 * 1024
		gb4 = 4 * 1024 * 1024 * 1024
	)
	switch {
	case limitBytes >= gb4:
		return limitBytes + limitBytes/20
	case limitBytes >= gb2:
		return limitBytes + limitBytes/10
	default:
		return limitBytes + limitBytes*15/100
	}
}

// CreateContainer creates a container from the given options and returns
// its id. The caller starts the container separately when the lifecycle
// state machine asks for it.
func (c *Client) CreateContainer(
	ctx context.Context,
	opts CreateContainerOptions,
) (string, error) {
	envSlice := make([]string, 0, len(opts.Env))
	for k, v := range opts.Env {
		envSlice = append(envSlice, fmt.Sprintf("%s=%s", k, v))
	}

	exposed := map[string]struct{}{}
	portBindings := map[string][]map[string]string{}
	for containerPort, hostBinding := range opts.Ports {
		exposed[containerPort] = struct{}{}
		portBindings[containerPort] = []map[string]string{{"HostIp": "", "HostPort": hostBinding}}
	}

	capDrop := opts.DropCapabilities
	if len(capDrop) == 0 {
		capDrop = []string{
			"setpcap", "mknod", "audit_write", "net_raw", "dac_override",
			"fowner", "fsetid", "net_bind_service", "sys_chroot", "setfcap",
			"sys_ptrace",
		}
	}

	mem := opts.MemoryLimitBytes
	memLimit := memoryWithOverhead(mem)
	hostConfig := map[string]any{
		"Memory":            memLimit,
		"MemoryReservation": mem,
		"MemorySwap":        memLimit * 2, // allow up to 1× swap headroom
		"CpuPeriod":         int64(100_000),
		"CpuQuota":          opts.CPULimitPercent * 1_000,
		"PidsLimit":         opts.PidsLimit,
		"AutoRemove":        false,
		"NetworkMode":       "bridge",
		"CapDrop":           capDrop,
		"SecurityOpt":       []string{"no-new-privileges"},
		"Tmpfs":             map[string]string{"/tmp": "rw,exec,nosuid,size=100m"},
	}
	if opts.BindMount != "" {
		hostConfig["Binds"] = []string{
			fmt.Sprintf("%s:/home/container", opts.BindMount),
		}
	}
	if len(portBindings) > 0 {
		hostConfig["PortBindings"] = portBindings
	}

	body := map[string]any{
		"Image":      opts.Image,
		"Env":        envSlice,
		"WorkingDir": "/home/container",
		"Tty":        false,
		"OpenStdin":  true,
		"StdinOnce":  false,
		"HostConfig": hostConfig,
	}
	// Only pass a stop signal to Docker if it's a real Unix signal.
	// Console-command signals ("^stop" convention) are handled by the daemon
	// at stop time and must not be forwarded — Docker would reject or ignore
	// them and fall back to SIGTERM, which races against the console command.
	if opts.StopSignal != "" && !strings.HasPrefix(opts.StopSignal, "^") {
		body["StopSignal"] = opts.StopSignal
	}
	if len(exposed) > 0 {
		body["ExposedPorts"] = exposed
	}

	q := url.Values{}
	if opts.Name != "" {
		q.Set("name", opts.Name)
	}
	resp, err := c.do(ctx, http.MethodPost, "/containers/create?"+q.Encode(), body)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		return "", c.errorFromResponse(resp, "create container")
	}
	var decoded struct {
		ID string `json:"Id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&decoded); err != nil {
		return "", fmt.Errorf("decode create response: %w", err)
	}
	return decoded.ID, nil
}

// StartContainer starts the named container (idempotent — already-running
// containers return nil).
func (c *Client) StartContainer(ctx context.Context, idOrName string) error {
	resp, err := c.do(ctx, http.MethodPost, "/containers/"+idOrName+"/start", nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotModified {
		return nil
	}
	if resp.StatusCode/100 != 2 {
		return c.errorFromResponse(resp, "start container")
	}
	return nil
}

// StopContainer sends the container's configured stop signal and waits up
// to `graceSeconds` before SIGKILL.
func (c *Client) StopContainer(
	ctx context.Context,
	idOrName string,
	graceSeconds int,
) error {
	q := url.Values{}
	q.Set("t", fmt.Sprintf("%d", graceSeconds))
	resp, err := c.do(ctx, http.MethodPost, "/containers/"+idOrName+"/stop?"+q.Encode(), nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotModified {
		return nil
	}
	if resp.StatusCode/100 != 2 {
		return c.errorFromResponse(resp, "stop container")
	}
	return nil
}

// KillContainer SIGKILLs the named container.
func (c *Client) KillContainer(ctx context.Context, idOrName string) error {
	resp, err := c.do(ctx, http.MethodPost, "/containers/"+idOrName+"/kill", nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		return c.errorFromResponse(resp, "kill container")
	}
	return nil
}

// RestartContainer restarts the container with the configured stop signal
// and `graceSeconds` grace period.
func (c *Client) RestartContainer(
	ctx context.Context,
	idOrName string,
	graceSeconds int,
) error {
	q := url.Values{}
	q.Set("t", fmt.Sprintf("%d", graceSeconds))
	resp, err := c.do(ctx, http.MethodPost, "/containers/"+idOrName+"/restart?"+q.Encode(), nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		return c.errorFromResponse(resp, "restart container")
	}
	return nil
}

// ContainerState is the State portion of a container inspect, used by the
// lifecycle watcher's container_exit probe.
type ContainerState struct {
	Status    string `json:"Status"`
	Running   bool   `json:"Running"`
	ExitCode  int    `json:"ExitCode"`
	OOMKilled bool   `json:"OOMKilled"`
	Pid       int    `json:"Pid"`
	StartedAt string `json:"StartedAt"`
}

// InspectState returns just the State portion of a container inspect.
// Returns (nil, nil) when the container does not exist.
func (c *Client) InspectState(
	ctx context.Context,
	idOrName string,
) (*ContainerState, error) {
	resp, err := c.do(ctx, http.MethodGet, "/containers/"+idOrName+"/json", nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return nil, nil
	}
	if resp.StatusCode/100 != 2 {
		return nil, c.errorFromResponse(resp, "inspect container")
	}
	var body struct {
		State *ContainerState `json:"State"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return nil, fmt.Errorf("decode inspect: %w", err)
	}
	return body.State, nil
}

// InspectStopSignal returns the stop signal configured on the named container
// (e.g. "^stop", "SIGTERM"). Returns "" when the container is not found or
// has no explicit stop signal configured.
func (c *Client) InspectStopSignal(ctx context.Context, idOrName string) string {
	resp, err := c.do(ctx, http.MethodGet, "/containers/"+idOrName+"/json", nil)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		return ""
	}
	var body struct {
		Config struct {
			StopSignal string `json:"StopSignal"`
		} `json:"Config"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return ""
	}
	return body.Config.StopSignal
}

// StatsSnapshot is one normalised stats sample produced from a Docker
// stats stream frame. CPUFraction is the percentage of one core consumed
// during the sampling window (1.0 = one full core); MemoryBytes excludes
// the kernel's `cache` figure so it matches what `docker stats` displays.
type StatsSnapshot struct {
	MemoryBytes      int64
	MemoryLimitBytes int64
	CPUFraction      float64
	NetworkRxBytes   int64
	NetworkTxBytes   int64
	DiskReadBytes    int64
	DiskWriteBytes   int64
}

// StatsStream subscribes to the Docker stats stream for the named
// container. Each frame produces one StatsSnapshot on the returned
// channel; the channel closes when the context is cancelled or the
// container exits.
func (c *Client) StatsStream(
	ctx context.Context,
	idOrName string,
) (<-chan StatsSnapshot, error) {
	out := make(chan StatsSnapshot, 8)
	resp, err := c.do(
		ctx,
		http.MethodGet,
		"/containers/"+idOrName+"/stats?stream=1",
		nil,
	)
	if err != nil {
		close(out)
		return nil, err
	}
	if resp.StatusCode/100 != 2 {
		_ = resp.Body.Close()
		close(out)
		return nil, c.errorFromResponse(resp, "stats stream")
	}

	// Inspect once to get the container's init PID for the host-side cgroup fallback.
	containerPID := 0
	if state, err := c.InspectState(ctx, idOrName); err == nil && state != nil {
		containerPID = state.Pid
	}

	// Shared atomics updated by the io.stat poller goroutine below.
	var ioStatRead, ioStatWrite atomic.Int64

	// Poll rchar/wchar by summing /proc/*/io inside the container every second.
	// rchar/wchar count all VFS I/O (including virtual filesystems like 9p used
	// by Colima), unlike cgroup io.stat which only counts real block device I/O.
	go func() {
		ticker := time.NewTicker(time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				data, err := c.execInContainer(ctx, idOrName,
					"sh", "-c",
					`awk '/rchar/{r+=$2}/wchar/{w+=$2}END{print "r="r" w="w}' /proc/[0-9]*/io 2>/dev/null`,
				)
				if err != nil || len(data) == 0 {
					continue
				}
				r, w := parseProcIOOutput(data)
				ioStatRead.Store(r)
				ioStatWrite.Store(w)
			}
		}
	}()

	go func() {
		defer resp.Body.Close()
		defer close(out)
		decoder := json.NewDecoder(resp.Body)
		var prev struct {
			cpuTotal    int64
			systemCPU   int64
			haveBaseline bool
		}
		for {
			var frame statsFrame
			if err := decoder.Decode(&frame); err != nil {
				return
			}
			snapshot := StatsSnapshot{
				MemoryBytes:      frame.MemoryStats.Usage - frame.MemoryStats.Stats.Cache,
				MemoryLimitBytes: frame.MemoryStats.Limit,
			}
			if snapshot.MemoryBytes < 0 {
				snapshot.MemoryBytes = frame.MemoryStats.Usage
			}
			cpuDelta := frame.CPUStats.CPUUsage.TotalUsage - prev.cpuTotal
			systemDelta := frame.CPUStats.SystemCPUUsage - prev.systemCPU
			if prev.haveBaseline && systemDelta > 0 && cpuDelta > 0 {
				cores := float64(frame.CPUStats.OnlineCPUs)
				if cores == 0 {
					cores = float64(len(frame.CPUStats.CPUUsage.PercpuUsage))
				}
				if cores == 0 {
					cores = 1
				}
				snapshot.CPUFraction = (float64(cpuDelta) / float64(systemDelta)) * cores
			}
			prev.cpuTotal = frame.CPUStats.CPUUsage.TotalUsage
			prev.systemCPU = frame.CPUStats.SystemCPUUsage
			prev.haveBaseline = true

			for _, net := range frame.Networks {
				snapshot.NetworkRxBytes += net.RxBytes
				snapshot.NetworkTxBytes += net.TxBytes
			}

			for _, entry := range frame.BlkioStats.IoServiceBytesRecursive {
				switch strings.ToLower(entry.Op) {
				case "read":
					snapshot.DiskReadBytes += entry.Value
				case "write":
					snapshot.DiskWriteBytes += entry.Value
				}
			}
			if snapshot.DiskReadBytes == 0 && snapshot.DiskWriteBytes == 0 {
				if containerPID > 0 {
					snapshot.DiskReadBytes, snapshot.DiskWriteBytes = cgroupV2IOStat(containerPID)
				}
				if snapshot.DiskReadBytes == 0 && snapshot.DiskWriteBytes == 0 {
					snapshot.DiskReadBytes = ioStatRead.Load()
					snapshot.DiskWriteBytes = ioStatWrite.Load()
				}
			}

			select {
			case <-ctx.Done():
				return
			case out <- snapshot:
			}
		}
	}()
	return out, nil
}

type statsFrame struct {
	CPUStats struct {
		CPUUsage struct {
			TotalUsage   int64   `json:"total_usage"`
			PercpuUsage  []int64 `json:"percpu_usage"`
		} `json:"cpu_usage"`
		SystemCPUUsage int64 `json:"system_cpu_usage"`
		OnlineCPUs     int   `json:"online_cpus"`
	} `json:"cpu_stats"`
	MemoryStats struct {
		Usage int64 `json:"usage"`
		Limit int64 `json:"limit"`
		Stats struct {
			Cache int64 `json:"cache"`
		} `json:"stats"`
	} `json:"memory_stats"`
	Networks map[string]struct {
		RxBytes int64 `json:"rx_bytes"`
		TxBytes int64 `json:"tx_bytes"`
	} `json:"networks"`
	BlkioStats struct {
		IoServiceBytesRecursive []struct {
			Op    string `json:"op"`
			Value int64  `json:"value"`
		} `json:"io_service_bytes_recursive"`
	} `json:"blkio_stats"`
}

// cgroupV2IOStat reads cumulative block I/O bytes for a container using
// cgroup v2 io.stat. This is the fallback when Docker's blkio_stats is empty
// (cgroups v2 / Colima / recent kernels). pid is the container's init PID
// from docker inspect.
func cgroupV2IOStat(pid int) (readBytes, writeBytes int64) {
	cgroupData, err := os.ReadFile(fmt.Sprintf("/proc/%d/cgroup", pid))
	if err != nil {
		return 0, 0
	}
	var cgroupPath string
	for _, line := range strings.Split(string(cgroupData), "\n") {
		if strings.HasPrefix(line, "0::/") {
			cgroupPath = strings.TrimPrefix(line, "0::")
			break
		}
	}
	if cgroupPath == "" {
		return 0, 0
	}
	ioStatData, err := os.ReadFile("/sys/fs/cgroup" + strings.TrimRight(cgroupPath, "\r\n") + "/io.stat")
	if err != nil {
		return 0, 0
	}
	for _, line := range strings.Split(string(ioStatData), "\n") {
		fields := strings.Fields(line)
		for _, field := range fields {
			if v, ok := strings.CutPrefix(field, "rbytes="); ok {
				n, _ := strconv.ParseInt(v, 10, 64)
				readBytes += n
			} else if v, ok := strings.CutPrefix(field, "wbytes="); ok {
				n, _ := strconv.ParseInt(v, 10, 64)
				writeBytes += n
			}
		}
	}
	return readBytes, writeBytes
}

// execInContainer runs cmd inside the named container and returns stdout.
func (c *Client) execInContainer(ctx context.Context, idOrName string, cmd ...string) ([]byte, error) {
	execBody, _ := json.Marshal(map[string]any{
		"AttachStdout": true,
		"AttachStderr": false,
		"Cmd":          cmd,
	})
	createResp, err := c.do(ctx, http.MethodPost, "/containers/"+idOrName+"/exec", bytes.NewReader(execBody))
	if err != nil {
		return nil, err
	}
	defer createResp.Body.Close()
	var execID struct {
		Id string `json:"Id"`
	}
	if err := json.NewDecoder(createResp.Body).Decode(&execID); err != nil {
		return nil, err
	}

	startBody, _ := json.Marshal(map[string]any{"Detach": false})
	startResp, err := c.do(ctx, http.MethodPost, "/exec/"+execID.Id+"/start", bytes.NewReader(startBody))
	if err != nil {
		return nil, err
	}
	defer startResp.Body.Close()

	var out bytes.Buffer
	hdr := make([]byte, 8)
	for {
		if _, err := io.ReadFull(startResp.Body, hdr); err != nil {
			break
		}
		size := int(hdr[4])<<24 | int(hdr[5])<<16 | int(hdr[6])<<8 | int(hdr[7])
		if size == 0 {
			continue
		}
		payload := make([]byte, size)
		if _, err := io.ReadFull(startResp.Body, payload); err != nil {
			break
		}
		if hdr[0] == 1 {
			out.Write(payload)
		}
	}
	return out.Bytes(), nil
}

// parseProcIOOutput parses the output of the awk one-liner that sums
// rchar/wchar across /proc/*/io: "r=<N> w=<N>".
func parseProcIOOutput(data []byte) (readBytes, writeBytes int64) {
	for _, field := range strings.Fields(string(data)) {
		if v, ok := strings.CutPrefix(field, "r="); ok {
			readBytes, _ = strconv.ParseInt(v, 10, 64)
		} else if v, ok := strings.CutPrefix(field, "w="); ok {
			writeBytes, _ = strconv.ParseInt(v, 10, 64)
		}
	}
	return readBytes, writeBytes
}

// FollowLogs returns a stream of stdout/stderr lines for the named
// container, following until the context is cancelled. Caller must drain
// the channel.
func (c *Client) FollowLogs(
	ctx context.Context,
	idOrName string,
) (<-chan LogLine, error) {
	out := make(chan LogLine, 64)
	go func() {
		defer close(out)
		c.streamLogs(ctx, idOrName, out)
	}()
	return out, nil
}

// AttachConn returns a hijacked connection attached to the container's
// stdio for live console interaction (writes go to stdin, reads multiplex
// stdout + stderr in the standard 8-byte-header frame format).
func (c *Client) AttachConn(
	ctx context.Context,
	idOrName string,
) (net.Conn, *bufio.Reader, error) {
	q := url.Values{}
	q.Set("stream", "1")
	q.Set("stdin", "1")
	q.Set("stdout", "1")
	q.Set("stderr", "1")
	conn, err := net.Dial("unix", c.socketPath)
	if err != nil {
		return nil, nil, fmt.Errorf("dial docker socket: %w", err)
	}
	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		"http://docker/"+apiVersion+"/containers/"+idOrName+"/attach?"+q.Encode(),
		nil,
	)
	if err != nil {
		conn.Close()
		return nil, nil, err
	}
	req.Host = "docker"
	req.Header.Set("Connection", "Upgrade")
	req.Header.Set("Upgrade", "tcp")
	if err := req.Write(conn); err != nil {
		conn.Close()
		return nil, nil, fmt.Errorf("write attach request: %w", err)
	}
	reader := bufio.NewReader(conn)
	resp, err := http.ReadResponse(reader, req)
	if err != nil {
		conn.Close()
		return nil, nil, fmt.Errorf("read attach response: %w", err)
	}
	if resp.StatusCode != http.StatusSwitchingProtocols {
		body, _ := io.ReadAll(resp.Body)
		conn.Close()
		return nil, nil, fmt.Errorf(
			"attach: HTTP %d %s",
			resp.StatusCode,
			string(body),
		)
	}
	return conn, reader, nil
}

// RunningContainer is one entry returned by ListRunningContainers.
type RunningContainer struct {
	Name string // without leading "/"
	ID   string
}

// ContainerSummary is one entry returned by ListContainers.
type ContainerSummary struct {
	Name    string // without leading "/"
	ID      string
	Running bool
}

// ListRunningContainers returns all containers that are currently running
// and whose name matches the given prefix. The prefix comparison is against
// the first name Docker reports (Docker names always start with "/").
func (c *Client) ListRunningContainers(
	ctx context.Context,
	namePrefix string,
) ([]RunningContainer, error) {
	q := url.Values{}
	q.Set("filters", `{"status":["running"]}`)
	resp, err := c.do(ctx, http.MethodGet, "/containers/json?"+q.Encode(), nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		return nil, c.errorFromResponse(resp, "list containers")
	}
	var items []struct {
		ID    string   `json:"Id"`
		Names []string `json:"Names"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&items); err != nil {
		return nil, fmt.Errorf("decode container list: %w", err)
	}
	var out []RunningContainer
	for _, item := range items {
		if len(item.Names) == 0 {
			continue
		}
		name := strings.TrimPrefix(item.Names[0], "/")
		if strings.HasPrefix(name, namePrefix) {
			out = append(out, RunningContainer{Name: name, ID: item.ID})
		}
	}
	return out, nil
}

// ListContainers returns all containers (any status) whose name matches
// namePrefix, together with whether each is currently running.
func (c *Client) ListContainers(
	ctx context.Context,
	namePrefix string,
) ([]ContainerSummary, error) {
	q := url.Values{}
	q.Set("all", "1")
	resp, err := c.do(ctx, http.MethodGet, "/containers/json?"+q.Encode(), nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		return nil, c.errorFromResponse(resp, "list all containers")
	}
	var items []struct {
		ID    string   `json:"Id"`
		Names []string `json:"Names"`
		State string   `json:"State"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&items); err != nil {
		return nil, fmt.Errorf("decode container list: %w", err)
	}
	var out []ContainerSummary
	for _, item := range items {
		if len(item.Names) == 0 {
			continue
		}
		name := strings.TrimPrefix(item.Names[0], "/")
		if strings.HasPrefix(name, namePrefix) {
			out = append(out, ContainerSummary{
				Name:    name,
				ID:      item.ID,
				Running: item.State == "running",
			})
		}
	}
	return out, nil
}

// TailLogs returns the last `lines` lines from the container's log output.
// Frames use the standard Docker 8-byte multiplexed header format.
func (c *Client) TailLogs(
	ctx context.Context,
	idOrName string,
	lines int,
) (io.ReadCloser, error) {
	q := url.Values{}
	q.Set("stdout", "1")
	q.Set("stderr", "1")
	q.Set("tail", fmt.Sprintf("%d", lines))
	resp, err := c.do(ctx, http.MethodGet, "/containers/"+idOrName+"/logs?"+q.Encode(), nil)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode/100 != 2 {
		defer resp.Body.Close()
		return nil, c.errorFromResponse(resp, "tail logs")
	}
	return resp.Body, nil
}

// WaitForExit waits up to timeout for the named container to reach a
// not-running state. Returns true if the container exited within the timeout,
// false if the timeout elapsed or the container was not found. Used to let a
// graceful shutdown complete before force-removing on restart.
func (c *Client) WaitForExit(ctx context.Context, idOrName string, timeout time.Duration) bool {
	waitCtx := ctx
	if timeout > 0 {
		var cancel context.CancelFunc
		waitCtx, cancel = context.WithTimeout(ctx, timeout)
		defer cancel()
	}
	resp, err := c.do(waitCtx, http.MethodPost,
		"/containers/"+idOrName+"/wait?condition=not-running", nil)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode/100 == 2
}

// RemoveContainer deletes the container by name or id, with optional force.
func (c *Client) RemoveContainer(ctx context.Context, idOrName string, force bool) error {
	q := url.Values{}
	if force {
		q.Set("force", "true")
	}
	resp, err := c.do(ctx, http.MethodDelete, "/containers/"+idOrName+"?"+q.Encode(), nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return nil
	}
	if resp.StatusCode/100 != 2 {
		return c.errorFromResponse(resp, "remove container")
	}
	return nil
}

// RunInstallOptions describes the one-shot install container.
type RunInstallOptions struct {
	Name       string
	Image      string
	Entrypoint string
	Script     string
	Env        map[string]string
	ServerDir  string // host path mounted at /mnt/server
	TmpDir     string // host base dir for per-install temp files (e.g. cfg.DataDir/tmp)
}

// LogLine is a single line emitted by the install script.
type LogLine struct {
	Stream string // "stdout" | "stderr"
	Line   string
}

// RunInstall runs the install script in a fresh container, mirroring Wings'
// approach: the script is written to a known path under TmpDir (not
// os.MkdirTemp) so Docker Desktop / Colima can bind-mount it without hitting
// the macOS VM boundary. Tty is enabled so log output is plain text. Logs
// stream live (concurrent with wait) and the channel closes when the container
// exits.
func (c *Client) RunInstall(
	ctx context.Context,
	opts RunInstallOptions,
) (<-chan LogLine, <-chan int, <-chan error) {
	logs := make(chan LogLine, 256)
	exit := make(chan int, 1)
	errs := make(chan error, 1)

	go func() {
		defer close(logs)
		defer close(exit)
		defer close(errs)

		// Per-install temp directory under the configured tmp root — a fixed,
		// known path that the Docker host VM can see (unlike os.MkdirTemp which
		// produces /var/folders/... on macOS, outside Docker Desktop's mounts).
		installDir := filepath.Join(opts.TmpDir, opts.Name)
		if err := os.MkdirAll(installDir, 0o700); err != nil {
			errs <- fmt.Errorf("create install dir: %w", err)
			return
		}
		defer os.RemoveAll(installDir)

		script := strings.ReplaceAll(opts.Script, "\r\n", "\n")
		if err := os.WriteFile(filepath.Join(installDir, "install.sh"), []byte(script), 0o644); err != nil {
			errs <- fmt.Errorf("write install script: %w", err)
			return
		}

		envSlice := make([]string, 0, len(opts.Env))
		for k, v := range opts.Env {
			envSlice = append(envSlice, fmt.Sprintf("%s=%s", k, v))
		}

		mounts := []map[string]any{
			{"Type": "bind", "Source": opts.ServerDir, "Target": "/mnt/server", "ReadOnly": false},
			{"Type": "bind", "Source": installDir, "Target": "/mnt/install", "ReadOnly": true},
		}

		hostConfig := map[string]any{
			"Mounts": mounts,
			"Tmpfs":  map[string]string{"/tmp": "rw,exec,nosuid,size=50m"},
		}

		body := map[string]any{
			"Hostname":     "installer",
			"Image":        opts.Image,
			"Env":          envSlice,
			"Tty":          true,
			"AttachStdin":  true,
			"AttachStdout": true,
			"AttachStderr": true,
			"OpenStdin":    true,
			"WorkingDir":   "/mnt/server",
			"Cmd":          []string{opts.Entrypoint, "/mnt/install/install.sh"},
			"HostConfig":   hostConfig,
		}

		q := url.Values{}
		if opts.Name != "" {
			q.Set("name", opts.Name)
		}
		createResp, err := c.do(ctx, http.MethodPost, "/containers/create?"+q.Encode(), body)
		if err != nil {
			errs <- err
			return
		}
		defer createResp.Body.Close()
		if createResp.StatusCode/100 != 2 {
			errs <- c.errorFromResponse(createResp, "create install container")
			return
		}
		var decoded struct {
			ID string `json:"Id"`
		}
		if err := json.NewDecoder(createResp.Body).Decode(&decoded); err != nil {
			errs <- fmt.Errorf("decode install create: %w", err)
			return
		}
		id := decoded.ID

		defer func() {
			_ = c.RemoveContainer(context.Background(), id, true)
		}()

		startResp, err := c.do(ctx, http.MethodPost, "/containers/"+id+"/start", nil)
		if err != nil {
			errs <- err
			return
		}
		startResp.Body.Close()
		if startResp.StatusCode/100 != 2 {
			errs <- c.errorFromResponse(startResp, "start install container")
			return
		}

		// Stream logs concurrently so the caller sees output in real time.
		// With Tty:true the stream is plain text (no multiplexed 8-byte headers).
		// The goroutine exits naturally when the container stops and Docker
		// closes the follow stream.
		go c.streamTTYLogs(ctx, id, logs)

		waitResp, err := c.do(ctx, http.MethodPost, "/containers/"+id+"/wait?condition=not-running", nil)
		if err != nil {
			errs <- err
			return
		}
		defer waitResp.Body.Close()
		if waitResp.StatusCode/100 != 2 {
			errs <- c.errorFromResponse(waitResp, "wait install container")
			return
		}
		var waitBody struct {
			StatusCode int `json:"StatusCode"`
		}
		if err := json.NewDecoder(waitResp.Body).Decode(&waitBody); err != nil {
			errs <- fmt.Errorf("decode wait response: %w", err)
			return
		}
		exit <- waitBody.StatusCode
	}()

	return logs, exit, errs
}

// streamLogs reads the log stream for a non-TTY container using the Docker
// multiplexed 8-byte frame format and pushes lines onto out.
func (c *Client) streamLogs(ctx context.Context, id string, out chan<- LogLine) {
	resp, err := c.do(
		ctx,
		http.MethodGet,
		"/containers/"+id+"/logs?stdout=1&stderr=1&follow=1",
		nil,
	)
	if err != nil {
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		return
	}
	header := make([]byte, 8)
	for {
		if _, err := io.ReadFull(resp.Body, header); err != nil {
			return
		}
		streamID := header[0]
		size := int(header[4])<<24 | int(header[5])<<16 | int(header[6])<<8 | int(header[7])
		if size <= 0 {
			continue
		}
		payload := make([]byte, size)
		if _, err := io.ReadFull(resp.Body, payload); err != nil {
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
			out <- LogLine{Stream: stream, Line: line}
		}
	}
}

// streamTTYLogs reads the log stream for a TTY container (plain text, no
// multiplexed framing) and pushes each line onto out. All output from a TTY
// container is merged into stdout. ANSI escape sequences and bare carriage
// returns are stripped so the browser terminal renders lines correctly.
func (c *Client) streamTTYLogs(ctx context.Context, id string, out chan<- LogLine) {
	resp, err := c.do(
		ctx,
		http.MethodGet,
		"/containers/"+id+"/logs?stdout=1&stderr=1&follow=1",
		nil,
	)
	if err != nil {
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		return
	}
	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := cleanLogLine(scanner.Text())
		if line != "" {
			out <- LogLine{Stream: "stdout", Line: line}
		}
	}
}

func (c *Client) imageExists(ctx context.Context, image string) (bool, error) {
	// Use the filters query parameter instead of embedding the name in the
	// path — path-escaping slashes in registry image names (e.g.
	// ghcr.io/foo/bar:tag) is unreliable across Docker API router versions.
	q := url.Values{}
	q.Set("filters", fmt.Sprintf(`{"reference":[%q]}`, image))
	resp, err := c.do(ctx, http.MethodGet, "/images/json?"+q.Encode(), nil)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		return false, c.errorFromResponse(resp, "list images")
	}
	var items []json.RawMessage
	if err := json.NewDecoder(resp.Body).Decode(&items); err != nil {
		return false, fmt.Errorf("decode image list: %w", err)
	}
	return len(items) > 0, nil
}

func (c *Client) pullImage(ctx context.Context, image string) error {
	q := url.Values{}
	q.Set("fromImage", image)
	resp, err := c.do(ctx, http.MethodPost, "/images/create?"+q.Encode(), nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		return c.errorFromResponse(resp, "pull image")
	}
	// Drain the streaming pull response. Each line is a JSON status object;
	// log status lines so slow pulls are visible in the daemon output.
	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()
		var frame struct {
			Status string `json:"status"`
		}
		if err := json.Unmarshal([]byte(line), &frame); err == nil && frame.Status != "" {
			log.Printf("daemon: pull %s: %s", image, frame.Status)
		}
	}
	return scanner.Err()
}

func (c *Client) do(
	ctx context.Context,
	method string,
	path string,
	body any,
) (*http.Response, error) {
	var reader io.Reader
	if body != nil {
		buf, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("marshal request body: %w", err)
		}
		reader = bytes.NewReader(buf)
	}
	req, err := http.NewRequestWithContext(
		ctx,
		method,
		"http://docker/"+strings.TrimPrefix(apiVersion+path, "/"),
		reader,
	)
	if err != nil {
		return nil, err
	}
	req.Host = "docker"
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	return c.httpClient.Do(req)
}

func (c *Client) errorFromResponse(resp *http.Response, context string) error {
	body, _ := io.ReadAll(resp.Body)
	if len(body) == 0 {
		return fmt.Errorf("%s: HTTP %d", context, resp.StatusCode)
	}
	var msg struct {
		Message string `json:"message"`
	}
	if err := json.Unmarshal(body, &msg); err == nil && msg.Message != "" {
		return errors.New(context + ": " + msg.Message)
	}
	return fmt.Errorf("%s: HTTP %d %s", context, resp.StatusCode, string(body))
}

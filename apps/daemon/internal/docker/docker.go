// Package docker wraps the small subset of Docker Engine API operations the
// daemon performs: ensure image, create container with HostConfig, run a
// one-shot install container, and stream container logs.
//
// Implemented against the Docker Engine HTTP API directly (over the unix
// socket) so the daemon binary stays small and we don't pull in the full
// docker/docker SDK + go-connections + sirupsen/logrus tree.
package docker

import (
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
)

const apiVersion = "v1.43"

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

// EnsureImage pulls `image` if it is not already present. Returns nil when
// the image is available.
func (c *Client) EnsureImage(ctx context.Context, image string) error {
	if found, err := c.imageExists(ctx, image); err != nil {
		return fmt.Errorf("inspect image %q: %w", image, err)
	} else if found {
		return nil
	}
	return c.pullImage(ctx, image)
}

// CreateContainerOptions describes everything the daemon supplies when
// creating a server container. `Name` becomes the Docker container name;
// `BindMount` is the host path mounted at /home/container.
type CreateContainerOptions struct {
	Name              string
	Image             string
	Env               map[string]string
	Cmd               []string
	StopSignal        string
	BindMount         string
	MemoryLimitBytes  int64
	CPULimitPercent   int64
	Ports             map[string]string
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

	hostConfig := map[string]any{
		"Memory":      opts.MemoryLimitBytes,
		"NanoCpus":    opts.CPULimitPercent * 10_000_000,
		"AutoRemove":  false,
		"NetworkMode": "bridge",
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
		"Image":        opts.Image,
		"Env":          envSlice,
		"WorkingDir":   "/home/container",
		"Tty":          false,
		"OpenStdin":    true,
		"StdinOnce":    false,
		"AttachStdout": true,
		"AttachStderr": true,
		"AttachStdin":  true,
		"HostConfig":   hostConfig,
	}
	if opts.StopSignal != "" {
		body["StopSignal"] = opts.StopSignal
	}
	if len(opts.Cmd) > 0 {
		body["Cmd"] = opts.Cmd
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
	BindMount  string
}

// LogLine is a single line emitted by the install script.
type LogLine struct {
	Stream string // "stdout" | "stderr"
	Line   string
}

// RunInstall runs the install script in a fresh container. The container is
// removed on completion (regardless of exit code). LogLines are pushed onto
// the returned channel as they arrive; the channel closes when the
// container exits and the returned exit code reflects the container's
// status.
func (c *Client) RunInstall(
	ctx context.Context,
	opts RunInstallOptions,
) (<-chan LogLine, <-chan int, <-chan error) {
	logs := make(chan LogLine, 64)
	exit := make(chan int, 1)
	errs := make(chan error, 1)

	go func() {
		defer close(logs)
		defer close(exit)
		defer close(errs)

		envSlice := make([]string, 0, len(opts.Env))
		for k, v := range opts.Env {
			envSlice = append(envSlice, fmt.Sprintf("%s=%s", k, v))
		}

		hostConfig := map[string]any{
			"AutoRemove": true,
		}
		if opts.BindMount != "" {
			hostConfig["Binds"] = []string{
				fmt.Sprintf("%s:/mnt/server", opts.BindMount),
			}
		}

		body := map[string]any{
			"Image":      opts.Image,
			"Env":        envSlice,
			"Tty":        false,
			"WorkingDir": "/mnt/server",
			"Cmd":        []string{opts.Entrypoint, "-c", opts.Script},
			"HostConfig": hostConfig,
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

		go c.streamLogs(ctx, id, logs)

		waitResp, err := c.do(ctx, http.MethodPost, "/containers/"+id+"/wait", nil)
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

func (c *Client) imageExists(ctx context.Context, image string) (bool, error) {
	resp, err := c.do(ctx, http.MethodGet, "/images/"+url.PathEscape(image)+"/json", nil)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return false, nil
	}
	if resp.StatusCode/100 != 2 {
		return false, c.errorFromResponse(resp, "inspect image")
	}
	return true, nil
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
	if _, err := io.Copy(io.Discard, resp.Body); err != nil {
		return fmt.Errorf("drain image pull stream: %w", err)
	}
	return nil
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

package environment

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"strings"
	"time"

	"github.com/stellarstack/daemon/internal/docker"
)

// IssueStop fires the stop policy. Fire-and-forget: this returns as soon
// as the command/signal has been sent to Docker. WaitForStop is what
// actually blocks. Mirrors Wings' Environment::Stop which sets the
// stopping state and dispatches the signal/command without blocking.
func (e *Environment) IssueStop(ctx context.Context) error {
	stop := e.Stop()
	e.setState(StateStopping)

	switch stop.Type {
	case "command":
		// Write "<cmd>\n" to the container stdin via a fresh attach.
		// Closing the attach immediately is fine — the container reads
		// the line and continues; we don't need to keep stdin open.
		if stop.Value == "" {
			return errors.New("stop command policy with empty value")
		}
		writeCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
		defer cancel()
		conn, _, err := e.docker.Attach(writeCtx, e.containerName, docker.AttachOptions{
			Stdin:  true,
			Stdout: true,
			Stderr: true,
			Stream: true,
		})
		if err != nil {
			// Fall back to SIGTERM — same as Pelican's behavior when
			// send_command fails.
			log.Printf("environment: stop attach failed: %v; falling back to SIGTERM", err)
			return e.docker.KillContainer(context.Background(), e.containerName, "SIGTERM")
		}
		defer conn.Close()
		_, _ = io.WriteString(conn, stop.Value+"\n")
		return nil
	case "signal":
		signal := stop.Value
		if signal == "" {
			signal = "SIGTERM"
		}
		return e.docker.KillContainer(ctx, e.containerName, signal)
	default:
		// Empty / native — let Docker use the container's configured
		// StopSignal. Use a 0-second grace so the signal goes immediately
		// and we control the wait timeout ourselves.
		err := e.docker.StopContainer(ctx, e.containerName, 0)
		var nf *docker.ContainerNotFoundError
		if errors.As(err, &nf) {
			return nil
		}
		return err
	}
}

// WaitForStop runs the stop policy and blocks until the container has
// exited. If `terminate` is true and the container is still alive after
// the grace period, sends SIGKILL.
//
// Always emits StateOffline before returning (success or error) so the
// panel never sees the daemon hung in StateStopping.
func (e *Environment) WaitForStop(ctx context.Context, grace time.Duration, terminate bool) error {
	if !e.docker.IsRunning(ctx, e.containerName) {
		e.setState(StateOffline)
		return nil
	}
	if err := e.IssueStop(ctx); err != nil {
		log.Printf("environment: issue stop: %v", err)
	}

	waitCtx, cancel := context.WithTimeout(ctx, grace)
	defer cancel()
	exited := e.docker.WaitNotRunning(waitCtx, e.containerName)
	if !exited && terminate {
		log.Printf("environment: %s did not exit within %s, sending SIGKILL", e.containerName, grace)
		killCtx, kc := context.WithTimeout(context.Background(), 10*time.Second)
		_ = e.docker.KillContainer(killCtx, e.containerName, "SIGKILL")
		kc()
		final, fc := context.WithTimeout(context.Background(), 10*time.Second)
		_ = e.docker.WaitNotRunning(final, e.containerName)
		fc()
	}
	e.setState(StateOffline)
	return nil
}

// SendCommand writes `<line>\n` to the container stdin via a fresh
// attach. Returns an error if the container isn't running or attach
// fails. Used by the WS `send command` event.
func (e *Environment) SendCommand(ctx context.Context, line string) error {
	if !e.docker.IsRunning(ctx, e.containerName) {
		return errors.New("container not running")
	}
	writeCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	conn, _, err := e.docker.Attach(writeCtx, e.containerName, docker.AttachOptions{
		Stdin:  true,
		Stdout: true,
		Stderr: true,
		Stream: true,
	})
	if err != nil {
		return fmt.Errorf("attach: %w", err)
	}
	defer conn.Close()
	if _, err := io.WriteString(conn, strings.TrimRight(line, "\n")+"\n"); err != nil {
		return fmt.Errorf("write: %w", err)
	}
	return nil
}

// Terminate sends the supplied signal directly. Used by the kill power
// action and by WaitForStop's force-kill path.
func (e *Environment) Terminate(ctx context.Context, signal string) error {
	if signal == "" {
		signal = "SIGKILL"
	}
	err := e.docker.KillContainer(ctx, e.containerName, signal)
	var nf *docker.ContainerNotFoundError
	if errors.As(err, &nf) {
		e.setState(StateOffline)
		return nil
	}
	return err
}

// MarkRunning is called by the start path after Docker confirms the
// container is up. Flips state to running unconditionally.
func (e *Environment) MarkRunning() { e.setState(StateRunning) }

// MarkStarting is called at the top of Start so the UI immediately
// reflects user intent.
func (e *Environment) MarkStarting() { e.setState(StateStarting) }

// MarkOffline flips to offline. Called by exit watchers and by manual
// kill paths.
func (e *Environment) MarkOffline() { e.setState(StateOffline) }

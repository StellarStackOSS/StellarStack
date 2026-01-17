package checks

import (
	"context"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/MarquesCoding/StellarStack/installer/config"
)

/*
╔════════════════════════════════════════════════════════════════════════════╗
║                    SYSTEM DEPENDENCY CHECK FUNCTIONS                       ║
║                                                                            ║
║  These functions check whether required system dependencies are          ║
║  installed, running, and meet minimum version requirements.              ║
║                                                                            ║
║  All checks are designed to be non-blocking and provide helpful          ║
║  feedback about what's needed and how to fix missing dependencies.       ║
╚════════════════════════════════════════════════════════════════════════════╝
*/

/*
CheckDocker verifies that Docker is installed, the daemon is running,
and that the user has permission to access the Docker socket.

The Docker daemon is required for all installations to run containers.

Returns:
  *config.SystemCheck - Detailed Docker status information
*/
func CheckDocker(ctx context.Context) *config.SystemCheck {
	check := &config.SystemCheck{
		Name:        "Docker",
		RequiredFor: "All installations",
	}

	/*
	Attempt to run 'docker version' command.
	This verifies both installation and daemon connectivity.
	*/
	cmd := exec.CommandContext(ctx, "docker", "version", "--format", "{{.Server.Version}}")
	output, err := cmd.Output()

	if err != nil {
		/*
		If docker command fails, it's either:
		1. Not installed (command not found)
		2. Daemon not running (connection refused)
		3. Permission denied (user not in docker group)

		We distinguish between these cases to provide helpful error messages.
		*/
		if os.IsNotExist(err) {
			check.ErrorMessage = "Docker is not installed. Install with: curl -fsSL https://get.docker.com | sh"
			return check
		}

		if strings.Contains(err.Error(), "permission denied") {
			check.ErrorMessage = "Permission denied accessing Docker. Add current user to docker group: usermod -aG docker $USER"
			check.IsInstalled = true
			return check
		}

		check.ErrorMessage = "Docker daemon is not running or unreachable. Start with: systemctl start docker"
		check.IsInstalled = true
		return check
	}

	/*
	If command succeeded, Docker is installed and running
	*/
	check.IsInstalled = true
	check.IsRunning = true
	check.Version = strings.TrimSpace(string(output))

	return check
}

/*
CheckDockerCompose verifies that Docker Compose is available.
Docker Compose is required to orchestrate multiple containers.

Note: Docker Compose can be provided in two ways:
1. As a Docker plugin (docker compose)
2. As a standalone tool (docker-compose)

Both forms are acceptable.

Returns:
  *config.SystemCheck - Detailed Docker Compose status
*/
func CheckDockerCompose(ctx context.Context) *config.SystemCheck {
	check := &config.SystemCheck{
		Name:        "Docker Compose",
		RequiredFor: "All installations",
	}

	/*
	First, try the modern Docker plugin form (docker compose)
	This is the preferred method for recent Docker versions.
	*/
	cmd := exec.CommandContext(ctx, "docker", "compose", "version", "--short")
	output, err := cmd.Output()

	if err == nil {
		check.IsInstalled = true
		check.Version = strings.TrimSpace(string(output))
		return check
	}

	/*
	Fall back to standalone docker-compose command
	This is still supported for older Docker installations.
	*/
	cmd = exec.CommandContext(ctx, "docker-compose", "--version")
	output, err = cmd.Output()

	if err == nil {
		check.IsInstalled = true
		check.Version = strings.TrimSpace(string(output))
		return check
	}

	/*
	Neither form of Docker Compose was found
	*/
	check.ErrorMessage = "Docker Compose not found. Install with: curl -L 'https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)' -o /usr/local/bin/docker-compose && chmod +x /usr/local/bin/docker-compose"

	return check
}

/*
CheckNginx checks if nginx is installed and whether it's currently running.
nginx is required as a reverse proxy for web traffic to panel and API.

Returns:
  *config.SystemCheck - Detailed nginx status
*/
func CheckNginx(ctx context.Context) *config.SystemCheck {
	check := &config.SystemCheck{
		Name:        "Nginx",
		RequiredFor: "Panel and API installations",
	}

	/*
	Check if nginx binary is available
	*/
	cmd := exec.CommandContext(ctx, "nginx", "-v")
	_, err := cmd.CombinedOutput()

	if err != nil {
		check.ErrorMessage = "nginx is not installed. Install with: apt-get install -y nginx"
		return check
	}

	check.IsInstalled = true

	/*
	Check if nginx service is running.
	We use systemctl to check service status (works on most modern Linux systems).
	*/
	cmd = exec.CommandContext(ctx, "systemctl", "is-active", "--quiet", "nginx")
	err = cmd.Run()

	if err == nil {
		check.IsRunning = true
	} else {
		check.ErrorMessage = "nginx is installed but not running. Start with: systemctl start nginx"
	}

	return check
}

/*
CheckCertbot checks if certbot (Let's Encrypt client) is installed.
Certbot is used to obtain and renew SSL/TLS certificates.

Returns:
  *config.SystemCheck - Detailed certbot status
*/
func CheckCertbot(ctx context.Context) *config.SystemCheck {
	check := &config.SystemCheck{
		Name:        "Certbot",
		RequiredFor: "SSL certificate generation with Let's Encrypt",
	}

	/*
	Check certbot availability and version
	*/
	cmd := exec.CommandContext(ctx, "certbot", "--version")
	output, err := cmd.Output()

	if err != nil {
		check.ErrorMessage = "Certbot is not installed. Install with: apt-get install -y certbot python3-certbot-nginx"
		return check
	}

	check.IsInstalled = true
	check.Version = strings.TrimSpace(string(output))

	return check
}

/*
CheckGit verifies that git is installed.
Git is required when installing the daemon to clone the repository.

Returns:
  *config.SystemCheck - Detailed git status
*/
func CheckGit(ctx context.Context) *config.SystemCheck {
	check := &config.SystemCheck{
		Name:        "Git",
		RequiredFor: "Daemon installation",
	}

	/*
	Check git availability
	*/
	cmd := exec.CommandContext(ctx, "git", "--version")
	output, err := cmd.Output()

	if err != nil {
		check.ErrorMessage = "Git is not installed. Install with: apt-get install -y git"
		return check
	}

	check.IsInstalled = true
	check.Version = strings.TrimSpace(string(output))

	return check
}

/*
CheckRust verifies that Rust and Cargo are installed.
Rust/Cargo is required to build the daemon from source.

Returns:
  *config.SystemCheck - Detailed Rust status
*/
func CheckRust(ctx context.Context) *config.SystemCheck {
	check := &config.SystemCheck{
		Name:        "Rust/Cargo",
		RequiredFor: "Daemon installation",
	}

	/*
	Check rustc (Rust compiler) version
	*/
	cmd := exec.CommandContext(ctx, "rustc", "--version")
	output, err := cmd.Output()

	if err != nil {
		check.ErrorMessage = "Rust is not installed. Install with: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
		return check
	}

	check.IsInstalled = true
	check.Version = strings.TrimSpace(string(output))

	return check
}

/*
CheckSystemRequirements performs all system dependency checks in parallel.
This is faster than checking sequentially and returns comprehensive results.

Parameters:
  ctx - Context for cancellation and timeout
  installType - Type of installation to check (determines which checks are needed)

Returns:
  *config.SystemCheckResult - Results for all system dependencies
*/
func CheckSystemRequirements(ctx context.Context, installType config.InstallationType) *config.SystemCheckResult {
	/*
	Create channels for receiving check results.
	Each check will complete asynchronously.
	*/
	dockerChan := make(chan *config.SystemCheck, 1)
	dockerComposeChan := make(chan *config.SystemCheck, 1)
	nginxChan := make(chan *config.SystemCheck, 1)
	certbotChan := make(chan *config.SystemCheck, 1)
	gitChan := make(chan *config.SystemCheck, 1)
	rustChan := make(chan *config.SystemCheck, 1)

	/*
	Run common checks in parallel goroutines.
	These are needed for all installation types.
	*/
	go func() {
		dockerChan <- CheckDocker(ctx)
	}()

	go func() {
		dockerComposeChan <- CheckDockerCompose(ctx)
	}()

	go func() {
		nginxChan <- CheckNginx(ctx)
	}()

	go func() {
		certbotChan <- CheckCertbot(ctx)
	}()

	/*
	For daemon installations, also check Git and Rust
	*/
	if installType == config.Daemon || installType == config.AllInOne {
		go func() {
			gitChan <- CheckGit(ctx)
		}()

		go func() {
			rustChan <- CheckRust(ctx)
		}()
	}

	/*
	Collect results with a timeout to prevent hanging
	*/
	timeout := time.After(config.DNSCheckTimeout)

	result := &config.SystemCheckResult{
		Docker:        <-dockerChan,
		DockerCompose: <-dockerComposeChan,
		Nginx:         <-nginxChan,
		Certbot:       <-certbotChan,
	}

	/*
	Only wait for daemon-specific checks if they were started
	*/
	if installType == config.Daemon || installType == config.AllInOne {
		select {
		case result.Git = <-gitChan:
		case <-timeout:
			result.Git = &config.SystemCheck{
				Name:         "Git",
				ErrorMessage: "Check timed out",
			}
		}

		select {
		case result.Rust = <-rustChan:
		case <-timeout:
			result.Rust = &config.SystemCheck{
				Name:         "Rust/Cargo",
				ErrorMessage: "Check timed out",
			}
		}
	}

	return result
}

/*
CheckExistingInstallation detects if StellarStack is already installed.
Used to determine if this is a fresh install or an update.

Parameters:
  installDir - Path to check for existing installation

Returns:
  bool - True if installation exists
  string - Version of existing installation (if found)
  error - Error if check failed
*/
func CheckExistingInstallation(installDir string) (bool, string, error) {
	/*
	Check for docker-compose.yml in install directory
	This is the primary indicator of an existing installation.
	*/
	dockerComposeFile := installDir + "/docker-compose.yml"

	if _, err := os.Stat(dockerComposeFile); err == nil {
		// File exists - this is an update
		return true, "", nil
	} else if !os.IsNotExist(err) {
		// Error checking file (permission denied, etc)
		return false, "", err
	}

	// File doesn't exist - fresh installation
	return false, "", nil
}

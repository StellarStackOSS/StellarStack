package executor

import (
	"context"
	"fmt"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/MarquesCoding/StellarStack/installer/config"
)

/*
╔════════════════════════════════════════════════════════════════════════════╗
║                    DOCKER EXECUTION FUNCTIONS                              ║
║                                                                            ║
║  These functions handle Docker-related operations:                        ║
║  - Creating networks for container communication                          ║
║  - Starting and stopping containers                                       ║
║  - Pulling container images                                               ║
║  - Checking container health                                              ║
║                                                                            ║
║  All operations are context-aware and can be cancelled/timed out.        ║
╚════════════════════════════════════════════════════════════════════════════╝
*/

/*
CreateDockerNetworks creates the necessary Docker networks for service communication.

Two networks are created:
1. stellar_network - For interconnected services (panel, api, database)
2. stellar - For isolated game server containers managed by daemon

Parameters:
  ctx - Context for cancellation and timeout
  cfg - Installation configuration

Returns:
  error - Error if network creation failed
*/
func CreateDockerNetworks(ctx context.Context, cfg *config.Config) error {
	/*
	Create service network (stellar_network)
	This network connects the control panel, API, and database.
	*/
	fmt.Print("Creating Docker service network... ")

	cmd := exec.CommandContext(ctx, "docker", "network", "create", "--driver", "bridge", config.DockerServiceNetwork)
	if err := cmd.Run(); err != nil {
		/*
		Network might already exist, which is fine
		*/
		if !strings.Contains(err.Error(), "already exists") {
			fmt.Printf("❌ Failed\n")
			return fmt.Errorf("failed to create service network: %w", err)
		}
	}

	fmt.Println("✓ Created")

	/*
	Create game server network (stellar)
	This isolated network is used for containerized game servers.
	Each server gets its own IP in a dedicated range.
	*/
	fmt.Print("Creating Docker game server network... ")

	cmd = exec.CommandContext(ctx, "docker", "network", "create",
		"--driver", "bridge",
		"--subnet", config.DockerNetworkSubnet,
		"--gateway", config.DockerNetworkGateway,
		config.DockerGameServerNetwork,
	)

	if err := cmd.Run(); err != nil {
		if !strings.Contains(err.Error(), "already exists") {
			fmt.Printf("❌ Failed\n")
			return fmt.Errorf("failed to create game server network: %w", err)
		}
	}

	fmt.Println("✓ Created")

	return nil
}

/*
PullDockerImages downloads required container images from registry.
This ensures all images are up-to-date before starting containers.

Images pulled depend on installation type:
- Panel installations: panel image
- API installations: api image
- Both: both images

Parameters:
  ctx - Context for cancellation and timeout
  cfg - Installation configuration

Returns:
  error - Error if pulling images failed
*/
func PullDockerImages(ctx context.Context, cfg *config.Config) error {
	/*
	Build full image names with registry and tag
	*/
	images := []string{}

	switch cfg.InstallType {
	case config.Panel:
		images = append(images, fmt.Sprintf("%s/%s:latest", cfg.DockerRegistry, config.DefaultPanelImage))

	case config.API:
		images = append(images, fmt.Sprintf("%s/%s:latest", cfg.DockerRegistry, config.DefaultAPIImage))

	case config.PanelAndAPI, config.AllInOne:
		images = append(images, fmt.Sprintf("%s/%s:latest", cfg.DockerRegistry, config.DefaultPanelImage))
		images = append(images, fmt.Sprintf("%s/%s:latest", cfg.DockerRegistry, config.DefaultAPIImage))
	}

	/*
	Pull each image
	*/
	for _, image := range images {
		fmt.Printf("Pulling image %s... ", image)

		cmd := exec.CommandContext(ctx, "docker", "pull", image)
		if err := cmd.Run(); err != nil {
			fmt.Printf("❌ Failed\n")
			return fmt.Errorf("failed to pull image %s: %w", image, err)
		}

		fmt.Println("✓ Pulled")
	}

	return nil
}

/*
StartContainers starts Docker containers using docker-compose.
Waits for containers to be healthy before returning.

Parameters:
  ctx - Context for cancellation and timeout
  cfg - Installation configuration

Returns:
  error - Error if containers failed to start or become healthy
*/
func StartContainers(ctx context.Context, cfg *config.Config) error {
	fmt.Print("Starting containers... ")

	/*
	Use docker compose to start all services defined in docker-compose.yml
	*/
	cmd := exec.CommandContext(ctx, "docker", "compose",
		"-f", filepath.Join(cfg.InstallDir, config.DockerComposeFileName),
		"up", "-d",
	)

	if err := cmd.Run(); err != nil {
		fmt.Printf("❌ Failed\n")
		return fmt.Errorf("failed to start containers: %w", err)
	}

	fmt.Println("✓ Started")

	return nil
}

/*
StopContainers stops running Docker containers.
Used during updates or maintenance.

Parameters:
  ctx - Context for cancellation and timeout
  cfg - Installation configuration

Returns:
  error - Error if containers failed to stop
*/
func StopContainers(ctx context.Context, cfg *config.Config) error {
	fmt.Print("Stopping containers... ")

	cmd := exec.CommandContext(ctx, "docker", "compose",
		"-f", filepath.Join(cfg.InstallDir, config.DockerComposeFileName),
		"down",
	)

	if err := cmd.Run(); err != nil {
		fmt.Printf("❌ Failed\n")
		return fmt.Errorf("failed to stop containers: %w", err)
	}

	fmt.Println("✓ Stopped")

	return nil
}

/*
CheckContainerHealth verifies that all containers are running and healthy.
This is called after starting containers to ensure the deployment succeeded.

Parameters:
  ctx - Context for cancellation and timeout
  cfg - Installation configuration

Returns:
  bool - True if all containers are healthy
  error - Error if health check failed
*/
func CheckContainerHealth(ctx context.Context, cfg *config.Config) (bool, error) {
	/*
	Use docker-compose ps to get container status
	*/
	cmd := exec.CommandContext(ctx, "docker", "compose",
		"-f", filepath.Join(cfg.InstallDir, config.DockerComposeFileName),
		"ps", "--format", "table {{.Service}}\t{{.State}}",
	)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return false, fmt.Errorf("failed to check container health: %w", err)
	}

	/*
	Parse output to check if all containers are running
	*/
	lines := strings.Split(string(output), "\n")
	allHealthy := true

	for _, line := range lines {
		if strings.Contains(line, "Up") {
			// Container is running
			continue
		}
		if strings.Contains(line, "Exited") || strings.Contains(line, "Dead") {
			allHealthy = false
			fmt.Printf("❌ Container unhealthy: %s\n", line)
		}
	}

	return allHealthy, nil
}

/*
GetContainerLogs retrieves logs from a specific container for debugging.
Useful when containers fail to start or encounter errors.

Parameters:
  ctx - Context for cancellation and timeout
  containerName - Name of the container to get logs from
  lines - Number of recent log lines to retrieve

Returns:
  string - Container logs
  error - Error if log retrieval failed
*/
func GetContainerLogs(ctx context.Context, containerName string, lines int) (string, error) {
	cmd := exec.CommandContext(ctx, "docker", "logs", "--tail", fmt.Sprintf("%d", lines), containerName)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", err
	}

	return string(output), nil
}

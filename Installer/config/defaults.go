package config

import (
	"os"
	"path/filepath"
	"runtime"
	"time"
)

/*
╔════════════════════════════════════════════════════════════════════════════╗
║                         INSTALLER CONSTANTS                                ║
║                                                                            ║
║  Version information and metadata for the installer itself.               ║
╚════════════════════════════════════════════════════════════════════════════╝
*/

const (
	InstallerVersion = "1.2.0"
	InstallerDate    = "2026-01-17"
	GitHubRepo       = "MarquesCoding/StellarStack"
)

/*
╔════════════════════════════════════════════════════════════════════════════╗
║                    INSTALLATION DIRECTORY PATHS                            ║
║                                                                            ║
║  These are the standard installation directories where StellarStack      ║
║  components, configuration, and data will be stored. Platform-aware       ║
║  defaults are set automatically. Can be customized via environment vars.  ║
╚════════════════════════════════════════════════════════════════════════════╝
*/

var (
	/*
	DefaultInstallDir is the root installation directory.
	Platform-specific:
	- Linux: /opt/stellarstack
	- macOS: /opt/stellarstack
	- Windows: C:\ProgramData\StellarStack
	*/
	DefaultInstallDir string

	/*
	DefaultDaemonInstallDir is where the daemon is installed.
	Platform-specific paths apply here as well.
	*/
	DefaultDaemonInstallDir string

	/*
	DefaultNginxConfDir is where nginx site configs are stored.
	Only applicable on Unix-like systems (Linux, macOS).
	*/
	DefaultNginxConfDir string

	/*
	DefaultNginxEnabledDir is where enabled nginx configs are linked.
	Only applicable on Unix-like systems.
	*/
	DefaultNginxEnabledDir string

	/*
	DefaultLetsEncryptDir is where Let's Encrypt certificates are stored.
	Platform-specific paths.
	*/
	DefaultLetsEncryptDir string
)

/*
init sets platform-specific directory paths and system requirements on startup
*/
func init() {
	/*
	Set platform-specific directory paths
	*/
	switch runtime.GOOS {
	case "windows":
		/*
		Windows installation paths
		Uses C:\ProgramData for system-wide data
		*/
		programData := os.Getenv("ProgramData")
		if programData == "" {
			programData = "C:\\ProgramData"
		}

		DefaultInstallDir = filepath.Join(programData, "StellarStack")
		DefaultDaemonInstallDir = filepath.Join(programData, "StellarStack-Daemon")
		DefaultNginxConfDir = filepath.Join(DefaultInstallDir, "nginx", "conf")
		DefaultNginxEnabledDir = filepath.Join(DefaultInstallDir, "nginx", "enabled")
		DefaultLetsEncryptDir = filepath.Join(DefaultInstallDir, "letsencrypt")

	case "darwin":
		/*
		macOS installation paths
		Uses /opt/stellarstack like Linux
		Could alternatively use /usr/local/stellarstack
		*/
		DefaultInstallDir = "/opt/stellarstack"
		DefaultDaemonInstallDir = "/opt/stellar-daemon"
		DefaultNginxConfDir = "/usr/local/etc/nginx/sites-available"
		DefaultNginxEnabledDir = "/usr/local/etc/nginx/sites-enabled"
		DefaultLetsEncryptDir = "/etc/letsencrypt"

	default:
		/*
		Linux and other Unix-like systems
		Standard Linux paths
		*/
		DefaultInstallDir = "/opt/stellarstack"
		DefaultDaemonInstallDir = "/opt/stellar-daemon"
		DefaultNginxConfDir = "/etc/nginx/sites-available"
		DefaultNginxEnabledDir = "/etc/nginx/sites-enabled"
		DefaultLetsEncryptDir = "/etc/letsencrypt"
	}

	/*
	Initialize platform-specific system requirements
	*/
	initSystemRequirements()
}

/*
╔════════════════════════════════════════════════════════════════════════════╗
║                         DOCKER CONFIGURATION                               ║
║                                                                            ║
║  Default Docker registry, image names, and other container settings.     ║
║  These can be overridden for private registries or custom images.        ║
╚════════════════════════════════════════════════════════════════════════════╝
*/

const (
	DefaultDockerRegistry    = "stellarstackoss"
	DefaultAPIImage          = "stellarstack-api"
	DefaultPanelImage        = "stellarstack-web"
	DefaultMonitoringImage   = "stellarstack-monitoring"
	DefaultComposeVersion    = "3.8"
)

/*
╔════════════════════════════════════════════════════════════════════════════╗
║                    DATABASE CONFIGURATION DEFAULTS                         ║
║                                                                            ║
║  Default PostgreSQL settings. Password is auto-generated for security.   ║
║  Database name and user are typically not changed.                       ║
╚════════════════════════════════════════════════════════════════════════════╝
*/

const (
	DefaultDatabaseUser      = "stellarstack"
	DefaultDatabaseName      = "stellarstack"
	DefaultDatabaseHost      = "postgres"
	DefaultDatabasePort      = "5432"
	DatabasePasswordLength   = 32
)

/*
╔════════════════════════════════════════════════════════════════════════════╗
║                      DAEMON CONFIGURATION DEFAULTS                         ║
║                                                                            ║
║  Default ports and settings for the game server daemon.                  ║
║  These can be customized but are typically left as-is.                   ║
╚════════════════════════════════════════════════════════════════════════════╝
*/

const (
	DefaultDaemonPort       = "8080"
	DefaultDaemonSFTPPort   = "2022"
	DefaultDaemonMaxConn    = 1000
)

/*
╔════════════════════════════════════════════════════════════════════════════╗
║                    RESOURCE LIMIT CONFIGURATION                            ║
║                                                                            ║
║  Default resource constraints for file uploads and requests.             ║
║  These help prevent abuse and excessive resource consumption.            ║
╚════════════════════════════════════════════════════════════════════════════╝
*/

const (
	DefaultUploadLimit      = "100M"
	DefaultMaxConnections   = 1000
	DefaultRequestTimeout   = 30 * time.Second
	DefaultCacheTimeout     = 5 * time.Minute
)

/*
╔════════════════════════════════════════════════════════════════════════════╗
║                        TIMEOUTS & DURATIONS                                ║
║                                                                            ║
║  Various timeout settings for network operations, health checks, etc.    ║
╚════════════════════════════════════════════════════════════════════════════╝
*/

const (
	DNSCheckTimeout         = 5 * time.Second
	ContainerHealthTimeout  = 2 * time.Minute
	ContainerStartupTimeout = 5 * time.Minute
	NginxReloadTimeout      = 10 * time.Second
)

/*
╔════════════════════════════════════════════════════════════════════════════╗
║                    CONFIGURATION FILE PATHS                                ║
║                                                                            ║
║  Paths to generated configuration files. These are created during        ║
║  installation and stored relative to the install directory.             ║
╚════════════════════════════════════════════════════════════════════════════╝
*/

const (
	DockerComposeFileName = "docker-compose.yml"
	EnvFileName           = ".env"
	BackupDirName         = ".backup"
	PostgresInitScript    = "postgres-init.sql"
	NginxPanelConfig      = "stellarstack-panel"
	NginxAPIConfig        = "stellarstack-api"
	NginxMonitoringConfig = "stellarstack-monitoring"
	NginxDaemonConfig     = "stellarstack-daemon"
)

/*
╔════════════════════════════════════════════════════════════════════════════╗
║                    DOCKER NETWORK CONFIGURATION                            ║
║                                                                            ║
║  Docker networks are created for service-to-service communication and   ║
║  to isolate game server containers managed by the daemon.               ║
╚════════════════════════════════════════════════════════════════════════════╝
*/

const (
	DockerServiceNetwork    = "stellar_network"
	DockerGameServerNetwork = "stellar"
	DockerNetworkSubnet     = "172.18.0.0/16"
	DockerNetworkGateway    = "172.18.0.1"
)

/*
╔════════════════════════════════════════════════════════════════════════════╗
║                  SYSTEM REQUIREMENT VERSIONS & CHECKS                      ║
║                                                                            ║
║  Minimum version requirements and check parameters for dependencies.     ║
╚════════════════════════════════════════════════════════════════════════════╝
*/

const (
	MinDockerVersion       = "20.10.0"
	MinDockerComposeVersion = "1.29.0"
	MinNginxVersion        = "1.18"
	MinRustVersion         = "1.60.0"
)

/*
╔════════════════════════════════════════════════════════════════════════════╗
║                    DEFAULT INSTALLATION STEPS                              ║
║                                                                            ║
║  The installation process follows these steps in order.                  ║
║  Steps can be skipped based on installation type and configuration.      ║
╚════════════════════════════════════════════════════════════════════════════╝
*/

var InstallationSteps = []string{
	"Welcome & Requirements",
	"Installation Type Selection",
	"Existing Installation Check",
	"System Dependencies Check",
	"Domain Configuration",
	"Admin Credentials Collection",
	"Dependency Installation",
	"Configuration Generation",
	"Nginx Setup",
	"SSL Certificate Generation",
	"Container Deployment",
	"Health Checks",
	"Installation Complete",
}

/*
╔════════════════════════════════════════════════════════════════════════════╗
║                      SSL/TLS CONFIGURATION DEFAULTS                        ║
║                                                                            ║
║  Let's Encrypt is the default SSL provider for new installations.        ║
║  Manual certificates can be provided if preferred.                      ║
╚════════════════════════════════════════════════════════════════════════════╝
*/

const (
	SSLProviderLetsEncrypt = "letsencrypt"
	SSLProviderManual      = "manual"
	SSLProviderSelfSigned  = "self-signed"
)

/*
╔════════════════════════════════════════════════════════════════════════════╗
║                    SYSTEM REQUIREMENT DESCRIPTIONS                         ║
║                                                                            ║
║  Human-readable descriptions of system requirements shown to users.      ║
╚════════════════════════════════════════════════════════════════════════════╝
*/

var SystemRequirements map[string]string

/*
initSystemRequirements sets platform-specific system requirements
*/
func initSystemRequirements() {
	baseRequirements := map[string]string{
		"ram":          "2GB RAM minimum (4GB+ recommended)",
		"disk":         "20GB disk space",
		"docker":       "Docker & Docker Compose",
		"cpu":          "1+ CPU cores",
	}

	switch runtime.GOOS {
	case "windows":
		baseRequirements["os"] = "Windows 10/11 Pro, Enterprise, or Server 2019+"
		baseRequirements["docker"] = "Docker Desktop with WSL2 or Hyper-V"
		baseRequirements["powershell"] = "PowerShell 5.1+"

	case "darwin":
		baseRequirements["os"] = "macOS 11 (Big Sur) or later"
		baseRequirements["docker"] = "Docker Desktop for macOS"
		baseRequirements["arch"] = "Intel or Apple Silicon (ARM64)"
		baseRequirements["homebrew"] = "Homebrew (for package management)"

	default:
		// Linux
		baseRequirements["os"] = "Ubuntu 20.04+ / Debian 11+ / RHEL 8+ / CentOS 8+"
		baseRequirements["curl"] = "curl or wget (for downloading)"
		baseRequirements["kernel"] = "Linux kernel 4.15+"
	}

	SystemRequirements = baseRequirements
}

/*
GetPlatformInfo returns information about the current platform
*/
func GetPlatformInfo() map[string]string {
	return map[string]string{
		"os":       runtime.GOOS,
		"arch":     runtime.GOARCH,
		"version":  InstallerVersion,
		"built":    InstallerDate,
	}
}

/*
IsSupportedPlatform checks if the current OS is supported
*/
func IsSupportedPlatform() bool {
	switch runtime.GOOS {
	case "windows", "darwin", "linux":
		return true
	default:
		return false
	}
}

/*
╔════════════════════════════════════════════════════════════════════════════╗
║                    MONITORING STACK COMPONENTS                             ║
║                                                                            ║
║  Optional monitoring components that can be installed alongside the      ║
║  main installation for observability.                                   ║
╚════════════════════════════════════════════════════════════════════════════╝
*/

var MonitoringComponents = []struct {
	Name        string
	Description string
	Enabled     bool
}{
	{
		Name:        "Prometheus",
		Description: "Metrics collection and time-series database",
		Enabled:     true,
	},
	{
		Name:        "Loki",
		Description: "Log aggregation and storage",
		Enabled:     true,
	},
	{
		Name:        "Grafana",
		Description: "Visualization and dashboarding",
		Enabled:     true,
	},
}

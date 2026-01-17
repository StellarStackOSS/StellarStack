package config

import "time"

/*
╔════════════════════════════════════════════════════════════════════════════╗
║                        INSTALLATION TYPE DEFINITIONS                       ║
║                                                                            ║
║  These types represent the different installation configurations that     ║
║  users can select. Each type determines which components will be          ║
║  installed and how they interact with each other.                        ║
╚════════════════════════════════════════════════════════════════════════════╝
*/

type InstallationType string

const (
	/*
	PanelAndAPI installs both the control panel and API server.
	This is the most common installation for production deployments.
	*/
	PanelAndAPI InstallationType = "panel_and_api"

	/*
	Panel installs only the web-based control panel.
	Requires an existing API server to connect to.
	*/
	Panel InstallationType = "panel"

	/*
	API installs only the backend API server without the web panel.
	Useful for headless deployments or when integrating with custom frontends.
	*/
	API InstallationType = "api"

	/*
	Daemon installs the game server management daemon.
	Can be deployed on separate machines to handle game server containers.
	*/
	Daemon InstallationType = "daemon"

	/*
	AllInOne installs all components in a single deployment.
	Panel + API + Daemon + monitoring stack.
	Best for small to medium deployments on a single server.
	*/
	AllInOne InstallationType = "all_in_one"
)

/*
╔════════════════════════════════════════════════════════════════════════════╗
║                     CONFIGURATION STRUCTURE DEFINITION                     ║
║                                                                            ║
║  This is the central data structure that holds all installation          ║
║  configuration. It's immutable after initial setup and used throughout   ║
║  the installation process.                                               ║
╚════════════════════════════════════════════════════════════════════════════╝
*/

type Config struct {
	/*
	Installation & Version Information
	─────────────────────────────────
	These fields track what version of StellarStack is being installed
	and basic installation metadata.
	*/
	Version              string
	InstallType          InstallationType
	InstallDir           string
	IsUpdate             bool
	Timestamp            time.Time

	/*
	Domain & Network Configuration
	──────────────────────────────
	Domains must be configured for each service and DNS verified before
	SSL certificate generation. Server IP is auto-detected or manually entered.
	*/
	ServerIP             string
	PanelDomain          string
	APIDomain            string
	MonitoringDomain     string
	DaemonDomain         string

	/*
	Administrative Credentials
	──────────────────────────
	Initial admin account created in the database during fresh installations.
	Only collected for fresh installs, not for updates.
	*/
	AdminEmail           string
	AdminPassword        string
	AdminFirstName       string
	AdminLastName        string

	/*
	Database Configuration
	──────────────────────
	PostgreSQL connection details. Randomly generated password on fresh install.
	*/
	DatabaseURL          string
	DatabaseUser         string
	DatabasePassword     string
	DatabaseName         string

	/*
	Docker Configuration
	────────────────────
	Container registry, image names, and Docker resource limits.
	*/
	DockerRegistry       string
	APIImageVersion      string
	PanelImageVersion    string

	/*
	Daemon Configuration (for Daemon and AllInOne installations)
	─────────────────────────────────────────────────────────────
	Connection details for daemon to reach the control panel API.
	*/
	DaemonPanelURL       string
	DaemonPort           string
	DaemonSFTPPort       string
	DaemonEnableSSL      bool
	DaemonEnableRedis    bool
	DaemonRedisURL       string

	/*
	Optional Features
	─────────────────
	Toggle installation of optional components like monitoring stack.
	*/
	InstallMonitoring    bool
	EnablePrometheus     bool
	EnableLoki           bool
	EnableGrafana        bool

	/*
	Upload & Resource Limits
	─────────────────────────
	Configure max file upload size and other resource constraints.
	*/
	UploadLimit          string
	MaxConnections       int
	RequestTimeout       time.Duration

	/*
	SSL/TLS Configuration
	─────────────────────
	SSL certificate settings and paths.
	*/
	UseSSL               bool
	SSLProvider          string // "letsencrypt", "manual", "self-signed"
	SSLEmail             string

	/*
	Dependency Installation Flags
	──────────────────────────────
	Tracks which system dependencies need to be installed.
	*/
	NeedDocker           bool
	NeedNginx            bool
	NeedCertbot          bool
	NeedGit              bool
	NeedRust             bool

	/*
	Configuration Handling Flags
	────────────────────────────
	Controls how existing configurations are handled during updates.
	*/
	SkipNginxConfig      bool
	SkipSSLGeneration    bool
	OverwriteConfigs     bool
	CreateBackup         bool
}

/*
╔════════════════════════════════════════════════════════════════════════════╗
║                    VALIDATION ERROR DEFINITIONS                            ║
║                                                                            ║
║  Structured error types for detailed validation feedback to users.        ║
║  Each error includes the field that failed, the value that was invalid,  ║
║  and a helpful error message.                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
*/

type ValidationError struct {
	Field   string
	Value   string
	Message string
}

type ValidationErrors []ValidationError

func (ve ValidationErrors) Error() string {
	if len(ve) == 0 {
		return "validation succeeded"
	}
	if len(ve) == 1 {
		return ve[0].Message
	}
	msg := "multiple validation errors:\n"
	for i, err := range ve {
		msg += "  " + string(rune(i+1)) + ". " + err.Field + ": " + err.Message + "\n"
	}
	return msg
}

func (ve ValidationErrors) Add(field, value, message string) ValidationErrors {
	return append(ve, ValidationError{
		Field:   field,
		Value:   value,
		Message: message,
	})
}

/*
╔════════════════════════════════════════════════════════════════════════════╗
║              SYSTEM REQUIREMENT CHECK RESULT DEFINITIONS                   ║
║                                                                            ║
║  Results from checking whether system dependencies are installed and      ║
║  whether they meet minimum version/configuration requirements.            ║
╚════════════════════════════════════════════════════════════════════════════╝
*/

type SystemCheck struct {
	Name          string
	IsInstalled   bool
	Version       string
	IsRunning     bool
	IsConfigured  bool
	ErrorMessage  string
	RequiredFor   string // Which install type needs this
}

type SystemCheckResult struct {
	Docker     *SystemCheck
	DockerCompose *SystemCheck
	Nginx      *SystemCheck
	Certbot    *SystemCheck
	Git        *SystemCheck
	Rust       *SystemCheck
	OpenSSL    *SystemCheck
}

/*
╔════════════════════════════════════════════════════════════════════════════╗
║                    DNS VERIFICATION RESULT DEFINITIONS                     ║
║                                                                            ║
║  When verifying that DNS records point to the correct server IP,         ║
║  we need to track what we found and provide helpful error messages.      ║
╚════════════════════════════════════════════════════════════════════════════╝
*/

type DNSVerifyResult struct {
	Domain       string
	ExpectedIP   string
	ResolvedIP   string
	IsVerified   bool
	Error        error
	ResolvAttempts int
}

/*
╔════════════════════════════════════════════════════════════════════════════╗
║                  INSTALLATION STEP STATE TRACKING                          ║
║                                                                            ║
║  Each step in the installation process can report its progress and       ║
║  any errors encountered. This helps with debugging and progress display. ║
╚════════════════════════════════════════════════════════════════════════════╝
*/

type StepResult struct {
	Step      string
	Success   bool
	Duration  time.Duration
	Error     error
	Details   map[string]interface{}
}

type InstallationProgress struct {
	CurrentStep  int
	TotalSteps   int
	Progress     float64 // 0.0 to 1.0
	CurrentTask  string
	Results      []StepResult
	StartTime    time.Time
	EstimatedEnd time.Time
}

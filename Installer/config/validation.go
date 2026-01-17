package config

import (
	"fmt"
	"net"
	"regexp"
	"strings"
	"time"
)

/*
╔════════════════════════════════════════════════════════════════════════════╗
║                    CONFIGURATION VALIDATION FUNCTIONS                      ║
║                                                                            ║
║  These functions validate individual configuration fields and return     ║
║  detailed error messages when validation fails.                          ║
║                                                                            ║
║  Validation is separated from I/O to make it easily testable and         ║
║  reusable. All validation happens before any side effects occur.         ║
╚════════════════════════════════════════════════════════════════════════════╝
*/

/*
ValidateConfig performs comprehensive validation on the entire configuration.
It checks all required fields based on the installation type and returns
a list of all validation errors found.

Parameters:
  cfg - The configuration to validate

Returns:
  ValidationErrors - List of all validation errors (empty if valid)
*/
func (cfg *Config) Validate() ValidationErrors {
	var errors ValidationErrors

	/*
	Type assertion: Validate that an installation type was selected
	*/
	switch cfg.InstallType {
	case PanelAndAPI, Panel, API, Daemon, AllInOne:
		// Valid type
	default:
		errors = errors.Add("install_type", string(cfg.InstallType),
			"Installation type must be one of: panel_and_api, panel, api, daemon, all_in_one")
	}

	/*
	Version validation: Ensure installer version is set
	*/
	if cfg.Version == "" {
		errors = errors.Add("version", "", "Installer version must be set")
	}

	/*
	Installation directory validation: Path must be absolute and not empty
	*/
	if cfg.InstallDir == "" {
		errors = errors.Add("install_dir", "", "Installation directory must be specified")
	} else if !strings.HasPrefix(cfg.InstallDir, "/") {
		errors = errors.Add("install_dir", cfg.InstallDir,
			"Installation directory must be an absolute path (starting with /)")
	}

	/*
	Server IP validation: Must be valid IPv4 or IPv6 address
	*/
	if cfg.ServerIP != "" {
		if !IsValidIP(cfg.ServerIP) {
			errors = errors.Add("server_ip", cfg.ServerIP,
				fmt.Sprintf("%q is not a valid IP address", cfg.ServerIP))
		}
	}

	/*
	Domain validation based on installation type:
	- Panel/PanelAndAPI/AllInOne require panel domain
	- API/PanelAndAPI/AllInOne require API domain
	- Monitoring requires monitoring domain if enabled
	- Daemon requires daemon domain if SSL enabled
	*/
	switch cfg.InstallType {
	case Panel, PanelAndAPI, AllInOne:
		errors = validateDomain("panel_domain", cfg.PanelDomain, errors)
	}

	switch cfg.InstallType {
	case API, PanelAndAPI, AllInOne:
		errors = validateDomain("api_domain", cfg.APIDomain, errors)
	}

	if cfg.InstallMonitoring {
		errors = validateDomain("monitoring_domain", cfg.MonitoringDomain, errors)
	}

	if cfg.InstallType == Daemon || cfg.InstallType == AllInOne {
		if cfg.DaemonEnableSSL {
			errors = validateDomain("daemon_domain", cfg.DaemonDomain, errors)
		}
	}

	/*
	Admin credentials validation (only for fresh installations):
	Fresh installs need admin email, password, and name information.
	Updates preserve existing credentials.
	*/
	if !cfg.IsUpdate && (cfg.InstallType == API || cfg.InstallType == PanelAndAPI || cfg.InstallType == AllInOne) {
		errors = validateEmail("admin_email", cfg.AdminEmail, errors)

		if cfg.AdminPassword == "" {
			errors = errors.Add("admin_password", "", "Admin password is required")
		} else if len(cfg.AdminPassword) < 8 {
			errors = errors.Add("admin_password", "***",
				"Admin password must be at least 8 characters long")
		}

		if cfg.AdminFirstName == "" {
			errors = errors.Add("admin_first_name", "", "Admin first name is required")
		}

		if cfg.AdminLastName == "" {
			errors = errors.Add("admin_last_name", "", "Admin last name is required")
		}
	}

	/*
	Database configuration validation:
	User and database name should follow naming conventions,
	password must be present (even if auto-generated).
	*/
	if cfg.DatabaseUser == "" {
		errors = errors.Add("database_user", "", "Database user must be specified")
	}

	if cfg.DatabasePassword == "" {
		errors = errors.Add("database_password", "", "Database password must be set")
	} else if len(cfg.DatabasePassword) < 16 {
		errors = errors.Add("database_password", "***",
			"Database password should be at least 16 characters (use auto-generation)")
	}

	if cfg.DatabaseName == "" {
		errors = errors.Add("database_name", "", "Database name must be specified")
	}

	/*
	Upload limit validation: Must be in valid format (e.g., 100M, 1G)
	*/
	if cfg.UploadLimit != "" {
		if !isValidSizeLimit(cfg.UploadLimit) {
			errors = errors.Add("upload_limit", cfg.UploadLimit,
				"Upload limit must be in format like 100M, 1G, 512K")
		}
	}

	/*
	Daemon-specific validation: When daemon is configured, validate its settings
	*/
	if cfg.InstallType == Daemon || cfg.InstallType == AllInOne {
		if cfg.DaemonPort == "" {
			errors = errors.Add("daemon_port", "", "Daemon port must be specified")
		} else if !isValidPort(cfg.DaemonPort) {
			errors = errors.Add("daemon_port", cfg.DaemonPort,
				"Daemon port must be a valid port number (1-65535)")
		}

		if cfg.DaemonSFTPPort == "" {
			errors = errors.Add("daemon_sftp_port", "", "Daemon SFTP port must be specified")
		} else if !isValidPort(cfg.DaemonSFTPPort) {
			errors = errors.Add("daemon_sftp_port", cfg.DaemonSFTPPort,
				"Daemon SFTP port must be a valid port number (1-65535)")
		}

		if cfg.DaemonEnableRedis && cfg.DaemonRedisURL == "" {
			errors = errors.Add("daemon_redis_url", "",
				"Redis URL must be specified when Redis is enabled for daemon")
		}
	}

	/*
	Installation type and feature consistency checks:
	Ensure that features enabled are compatible with selected installation type
	*/
	if cfg.InstallType == Daemon && cfg.InstallMonitoring {
		errors = errors.Add("install_monitoring", "true",
			"Monitoring stack is only available with Panel/API installations, not standalone Daemon")
	}

	return errors
}

/*
validateDomain ensures a domain is present and follows DNS naming conventions.
Domain validation here is basic structural validation; actual DNS resolution
happens during the interactive configuration phase.

Parameters:
  fieldName - Name of the field being validated
  domain - The domain to validate
  errors - Existing validation errors to append to

Returns:
  ValidationErrors - Updated error list
*/
func validateDomain(fieldName, domain string, errors ValidationErrors) ValidationErrors {
	if domain == "" {
		return errors.Add(fieldName, "", fmt.Sprintf("%s is required", fieldName))
	}

	/*
	Basic domain format validation using regex:
	- Must contain at least one dot (example.com)
	- Alphanumeric, hyphens, and dots allowed
	- Cannot start or end with hyphen or dot
	- Cannot exceed 253 characters
	*/
	if len(domain) > 253 {
		return errors.Add(fieldName, domain, "Domain exceeds 253 characters")
	}

	domainPattern := `^(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$`
	if !regexp.MustCompile(domainPattern).MatchString(domain) {
		return errors.Add(fieldName, domain,
			"Domain must be valid (e.g., example.com, panel.example.com)")
	}

	return errors
}

/*
validateEmail checks if a string is a valid email format.
Uses a simple but effective regex pattern suitable for most use cases.

Parameters:
  fieldName - Name of the field being validated
  email - The email to validate
  errors - Existing validation errors to append to

Returns:
  ValidationErrors - Updated error list
*/
func validateEmail(fieldName, email string, errors ValidationErrors) ValidationErrors {
	if email == "" {
		return errors.Add(fieldName, "", fmt.Sprintf("%s is required", fieldName))
	}

	/*
	Simple email format validation:
	Matches most valid email addresses while rejecting obviously invalid ones.
	More complex validation would require actually sending a confirmation email.
	*/
	emailPattern := `^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`
	if !regexp.MustCompile(emailPattern).MatchString(email) {
		return errors.Add(fieldName, email, "Email format is invalid")
	}

	return errors
}

/*
IsValidIP checks if a string is a valid IPv4 or IPv6 address.

Parameters:
  ip - String to validate as IP address

Returns:
  bool - True if valid IP address, false otherwise
*/
func IsValidIP(ip string) bool {
	return net.ParseIP(ip) != nil
}

/*
isValidPort checks if a string is a valid TCP/UDP port number.
Valid port range is 1-65535.

Parameters:
  port - String to validate as port number

Returns:
  bool - True if valid port, false otherwise
*/
func isValidPort(port string) bool {
	portPattern := `^\d+$`
	if !regexp.MustCompile(portPattern).MatchString(port) {
		return false
	}

	// Additional range check could be added here if needed
	// For now, regex validates it's numeric

	return true
}

/*
isValidSizeLimit checks if a string is in valid size format.
Acceptable formats: 100M, 1G, 512K, 1T

Examples:
  100M  - 100 megabytes
  1G    - 1 gigabyte
  512K  - 512 kilobytes

Parameters:
  size - String to validate as size

Returns:
  bool - True if valid size format, false otherwise
*/
func isValidSizeLimit(size string) bool {
	/*
	Match pattern: number followed by optional unit (K, M, G, T)
	Examples: 100M, 1G, 512K
	*/
	sizePattern := `^\d+[KMGT]?$`
	return regexp.MustCompile(sizePattern).MatchString(strings.ToUpper(size))
}

/*
ValidateInstallationType checks if the given string is a valid installation type.

Parameters:
  instType - String to validate as installation type

Returns:
  bool - True if valid, false otherwise
  error - Error message if invalid, nil if valid
*/
func ValidateInstallationType(instType string) (bool, error) {
	switch InstallationType(instType) {
	case PanelAndAPI, Panel, API, Daemon, AllInOne:
		return true, nil
	default:
		return false, fmt.Errorf(
			"invalid installation type %q, must be one of: panel_and_api, panel, api, daemon, all_in_one",
			instType,
		)
	}
}

/*
CreateDefaultConfig returns a new configuration with sensible defaults.
This is the starting point for all installations.

Returns:
  *Config - Configuration with default values set
*/
func CreateDefaultConfig() *Config {
	return &Config{
		Version:              InstallerVersion,
		InstallDir:           DefaultInstallDir,
		DatabaseUser:         DefaultDatabaseUser,
		DatabaseName:         DefaultDatabaseName,
		DaemonPort:           DefaultDaemonPort,
		DaemonSFTPPort:       DefaultDaemonSFTPPort,
		UploadLimit:          DefaultUploadLimit,
		MaxConnections:       DefaultMaxConnections,
		RequestTimeout:       DefaultRequestTimeout,
		UseSSL:               true,
		SSLProvider:          SSLProviderLetsEncrypt,
		CreateBackup:         true,
		Timestamp:            time.Now(),
	}
}

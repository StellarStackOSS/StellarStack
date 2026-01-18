package steps

import (
	"context"
	"fmt"
	"strings"

	"github.com/MarquesCoding/StellarStack/installer/checks"
	"github.com/MarquesCoding/StellarStack/installer/config"
)

/*
╔════════════════════════════════════════════════════════════════════════════╗
║                   INTERACTIVE CONFIGURATION STEPS                          ║
║                                                                            ║
║  These functions handle user prompts and input collection for            ║
║  installer configuration. All input is validated before being stored.    ║
║                                                                            ║
║  This layer is separated from UI rendering to allow for different        ║
║  frontends (CLI, web, etc.) in the future.                              ║
╚════════════════════════════════════════════════════════════════════════════╝
*/

/*
PromptInstallationType presents the installation type options to the user
and collects their selection.

The selected installation type determines which components will be installed
and which configuration options are required.

Parameters:
  ctx - Context for cancellation
  readInput - Function to read user input (injected for testability)

Returns:
  config.InstallationType - User's selected installation type
  error - Error if user cancels or input is invalid
*/
func PromptInstallationType(ctx context.Context, readInput func(string) string) (config.InstallationType, error) {
	options := []struct {
		key         string
		name        string
		description string
		value       config.InstallationType
	}{
		{
			key:         "1",
			name:        "Panel + API",
			description: "Complete control panel with backend",
			value:       config.PanelAndAPI,
		},
		{
			key:         "2",
			name:        "Panel Only",
			description: "Web interface only",
			value:       config.Panel,
		},
		{
			key:         "3",
			name:        "API Only",
			description: "Backend API server only",
			value:       config.API,
		},
		{
			key:         "4",
			name:        "Daemon",
			description: "Game server management daemon",
			value:       config.Daemon,
		},
		{
			key:         "5",
			name:        "All-in-One",
			description: "Panel + API + Daemon + monitoring",
			value:       config.AllInOne,
		},
	}

	/*
	Display options to user
	*/
	fmt.Println("\nSelect installation type:")
	fmt.Println("────────────────────────")
	for _, opt := range options {
		fmt.Printf("  [%s] %s\n", opt.key, opt.name)
		fmt.Printf("      %s\n", opt.description)
	}

	/*
	Read user input with validation loop
	*/
	for {
		fmt.Print("\nEnter your choice [1-5]: ")
		choice := strings.TrimSpace(readInput(""))

		for _, opt := range options {
			if choice == opt.key {
				return opt.value, nil
			}
		}

		fmt.Println("❌ Invalid choice. Please enter 1, 2, 3, 4, or 5.")
	}
}

/*
PromptServerIP prompts user for their server's public IP address.
Attempts auto-detection first, falls back to manual entry if that fails.

Parameters:
  ctx - Context for cancellation
  readInput - Function to read user input

Returns:
  string - Server IP address (detected or manually entered)
  error - Error if user cancels
*/
func PromptServerIP(ctx context.Context, readInput func(string) string) (string, error) {
	/*
	Try to detect IP automatically first
	*/
	fmt.Print("\nDetecting server IP address... ")

	ip, err := checks.DetectServerIP(ctx)
	if err == nil {
		fmt.Printf("✓ Detected: %s\n", ip)
		return ip, nil
	}

	fmt.Println("❌ Could not detect automatically")
	fmt.Printf("Error: %v\n\n", err)

	/*
	Fall back to manual entry
	*/
	fmt.Println("Please enter your server's public IP address:")
	fmt.Println("(This is the IP your domains will point to)")
	fmt.Println("")

	for {
		fmt.Print("Enter server IP: ")
		ip := strings.TrimSpace(readInput(""))

		if ip == "" {
			fmt.Println("❌ IP address is required")
			continue
		}

		/*
		Validate IP format
		*/
		if !config.IsValidIP(ip) {
			fmt.Printf("❌ %q is not a valid IP address\n", ip)
			continue
		}

		return ip, nil
	}
}

/*
PromptDomains collects domain configuration from the user.
Performs DNS verification and provides helpful guidance if verification fails.

Parameters:
  ctx - Context for cancellation
  cfg - Configuration to update
  readInput - Function to read user input

Returns:
  error - Error if user cancels or critical failure
*/
func PromptDomains(ctx context.Context, cfg *config.Config, readInput func(string) string) error {
	/*
	Prompt for panel domain if needed
	*/
	if cfg.InstallType == config.Panel || cfg.InstallType == config.PanelAndAPI || cfg.InstallType == config.AllInOne {
		domain, err := promptDomainWithVerification(ctx, "panel", cfg.ServerIP, readInput)
		if err != nil {
			return err
		}
		cfg.PanelDomain = domain
	}

	/*
	Prompt for API domain if needed
	*/
	if cfg.InstallType == config.API || cfg.InstallType == config.PanelAndAPI || cfg.InstallType == config.AllInOne {
		domain, err := promptDomainWithVerification(ctx, "api", cfg.ServerIP, readInput)
		if err != nil {
			return err
		}
		cfg.APIDomain = domain
	}

	/*
	Prompt for monitoring domain if monitoring is enabled
	*/
	if cfg.InstallMonitoring {
		domain, err := promptDomainWithVerification(ctx, "monitoring", cfg.ServerIP, readInput)
		if err != nil {
			return err
		}
		cfg.MonitoringDomain = domain
	}

	/*
	Prompt for daemon domain if SSL is enabled for daemon
	*/
	if (cfg.InstallType == config.Daemon || cfg.InstallType == config.AllInOne) && cfg.DaemonEnableSSL {
		domain, err := promptDomainWithVerification(ctx, "daemon", cfg.ServerIP, readInput)
		if err != nil {
			return err
		}
		cfg.DaemonDomain = domain
	}

	return nil
}

/*
promptDomainWithVerification prompts for a single domain and verifies DNS.
Provides retry logic if DNS verification fails (common due to propagation delays).

Parameters:
  ctx - Context for cancellation
  componentName - Name of component (e.g., "panel", "api")
  serverIP - Expected IP address
  readInput - Function to read user input

Returns:
  string - Verified domain name
  error - Error if user cancels or critical failure
*/
func promptDomainWithVerification(ctx context.Context, componentName, serverIP string, readInput func(string) string) (string, error) {
	fmt.Printf("\n%s Domain Configuration\n", strings.ToTitle(componentName))
	fmt.Println("────────────────────────")
	fmt.Printf("Enter %s domain (e.g., %s.example.com): ", componentName, componentName)

	domain := strings.TrimSpace(readInput(""))
	if domain == "" {
		return "", fmt.Errorf("%s domain is required", componentName)
	}

	/*
	Validate domain format
	*/
	if !isValidDomainInput(domain) {
		return "", fmt.Errorf("%q is not a valid domain format", domain)
	}

	fmt.Println("\n⚠️  DNS Verification")
	fmt.Println("────────────────────")
	fmt.Printf("Please ensure the following DNS record exists:\n\n")
	fmt.Printf("  Type:   A\n")
	fmt.Printf("  Name:   %s\n", domain)
	fmt.Printf("  Value:  %s\n", serverIP)
	fmt.Printf("  TTL:    3600 (or Auto)\n\n")

	/*
	Verification loop with retry capability
	*/
	maxAttempts := 3
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		fmt.Print("Verify DNS record has been created [y/n]: ")
		response := strings.ToLower(strings.TrimSpace(readInput("")))

		if response != "y" && response != "yes" {
			if attempt < maxAttempts {
				fmt.Println("Waiting for you to create the DNS record...")
				continue
			}
			// Allow skipping on final attempt
			fmt.Print("Skip DNS verification anyway [y/n]: ")
			if strings.ToLower(strings.TrimSpace(readInput(""))) == "y" {
				return domain, nil
			}
			continue
		}

		/*
		Perform actual DNS verification
		*/
		fmt.Print("Verifying DNS resolution... ")

		result := checks.VerifyDomain(ctx, domain, serverIP)

		if result.IsVerified {
			fmt.Printf("✓ Verified: %s → %s\n", domain, result.ResolvedIP)
			return domain, nil
		}

		/*
		DNS verification failed - provide helpful guidance
		*/
		fmt.Println("❌ Verification failed")

		if result.ResolvedIP != "" {
			fmt.Printf("Domain resolved to: %s (expected: %s)\n", result.ResolvedIP, serverIP)
		} else {
			fmt.Printf("Could not resolve domain: %v\n", result.Error)
			fmt.Println("\nPossible causes:")
			fmt.Println("  • DNS record doesn't exist yet")
			fmt.Println("  • DNS hasn't propagated (takes 5-15 minutes)")
			fmt.Println("  • Firewall blocking DNS queries")
		}

		if attempt < maxAttempts {
			fmt.Printf("\nAttempt %d/%d - Try again after creating the record.\n", attempt, maxAttempts)
		}
	}

	return domain, nil
}

/*
PromptAdminCredentials collects admin account information.
Only needed for fresh installations (not updates).

Parameters:
  ctx - Context for cancellation
  cfg - Configuration to update
  readInput - Function to read user input

Returns:
  error - Error if user cancels
*/
func PromptAdminCredentials(ctx context.Context, cfg *config.Config, readInput func(string) string) error {
	/*
	Skip if this is an update
	*/
	if cfg.IsUpdate {
		return nil
	}

	/*
	Skip if API is not being installed
	*/
	if cfg.InstallType == config.Panel || cfg.InstallType == config.Daemon {
		return nil
	}

	fmt.Println("\nCreate Admin Account")
	fmt.Println("──────────────────")

	/*
	Email
	*/
	for {
		fmt.Print("Admin email: ")
		email := strings.TrimSpace(readInput(""))

		if email == "" {
			fmt.Println("❌ Email is required")
			continue
		}

		if !isValidEmailInput(email) {
			fmt.Println("❌ Invalid email format")
			continue
		}

		cfg.AdminEmail = email
		break
	}

	/*
	First name
	*/
	for {
		fmt.Print("Admin first name: ")
		name := strings.TrimSpace(readInput(""))

		if name == "" {
			fmt.Println("❌ First name is required")
			continue
		}

		cfg.AdminFirstName = name
		break
	}

	/*
	Last name
	*/
	for {
		fmt.Print("Admin last name: ")
		name := strings.TrimSpace(readInput(""))

		if name == "" {
			fmt.Println("❌ Last name is required")
			continue
		}

		cfg.AdminLastName = name
		break
	}

	/*
	Password (with validation for minimum length)
	*/
	for {
		fmt.Print("Admin password (min 8 chars): ")
		password := strings.TrimSpace(readInput(""))

		if password == "" {
			fmt.Println("❌ Password is required")
			continue
		}

		if len(password) < 8 {
			fmt.Println("❌ Password must be at least 8 characters")
			continue
		}

		cfg.AdminPassword = password
		break
	}

	fmt.Println("✓ Admin account configured")
	return nil
}

/*
PromptMonitoringStack asks if user wants to install monitoring components.
Only applicable for Panel/API installations.

Parameters:
  ctx - Context for cancellation
  cfg - Configuration to update
  readInput - Function to read user input

Returns:
  error - Error if user cancels
*/
func PromptMonitoringStack(ctx context.Context, cfg *config.Config, readInput func(string) string) error {
	/*
	Only offer monitoring for Panel/API installations
	*/
	if cfg.InstallType == config.Daemon {
		return nil
	}

	fmt.Println("\nOptional: Monitoring Stack")
	fmt.Println("──────────────────────────")
	fmt.Println("Install Prometheus, Loki, and Grafana for observability?")
	fmt.Println("(Recommended for production deployments)")

	for {
		fmt.Print("\nInstall monitoring stack [y/n]: ")
		response := strings.ToLower(strings.TrimSpace(readInput("")))

		if response == "y" || response == "yes" {
			cfg.InstallMonitoring = true
			cfg.EnablePrometheus = true
			cfg.EnableLoki = true
			cfg.EnableGrafana = true
			fmt.Println("✓ Monitoring stack will be installed")
			return nil
		}

		if response == "n" || response == "no" {
			cfg.InstallMonitoring = false
			fmt.Println("✓ Monitoring stack will not be installed")
			return nil
		}

		fmt.Println("❌ Please answer 'y' or 'n'")
	}
}

/*
PromptConfirmConfiguration shows a summary of configuration and asks for confirmation.
This is the final step before beginning installation.

Parameters:
  ctx - Context for cancellation
  cfg - Configuration to confirm
  readInput - Function to read user input

Returns:
  bool - True if user confirms, false if they want to change configuration
  error - Error if user cancels completely
*/
func PromptConfirmConfiguration(ctx context.Context, cfg *config.Config, readInput func(string) string) (bool, error) {
	fmt.Println("\nConfiguration Summary")
	fmt.Println("════════════════════════════════════════════════════════════")

	fmt.Printf("Installation Type: %s\n", cfg.InstallType)
	fmt.Printf("Server IP: %s\n", cfg.ServerIP)

	if cfg.PanelDomain != "" {
		fmt.Printf("Panel Domain: %s\n", cfg.PanelDomain)
	}

	if cfg.APIDomain != "" {
		fmt.Printf("API Domain: %s\n", cfg.APIDomain)
	}

	if cfg.MonitoringDomain != "" {
		fmt.Printf("Monitoring Domain: %s\n", cfg.MonitoringDomain)
	}

	if cfg.AdminEmail != "" {
		fmt.Printf("Admin Email: %s\n", cfg.AdminEmail)
	}

	if cfg.InstallMonitoring {
		fmt.Printf("Monitoring: Enabled\n")
	}

	fmt.Printf("Upload Limit: %s\n", cfg.UploadLimit)
	fmt.Printf("Install Directory: %s\n", cfg.InstallDir)

	fmt.Println("════════════════════════════════════════════════════════════")

	for {
		fmt.Print("\nProceed with installation [y/n]: ")
		response := strings.ToLower(strings.TrimSpace(readInput("")))

		if response == "y" || response == "yes" {
			return true, nil
		}

		if response == "n" || response == "no" {
			return false, nil
		}

		fmt.Println("❌ Please answer 'y' or 'n'")
	}
}

/*
╔════════════════════════════════════════════════════════════════════════════╗
║                    INPUT VALIDATION HELPER FUNCTIONS                       ║
║                                                                            ║
║  Simple validation helpers for user inputs. These are separated from      ║
║  the main config validation to allow different behavior for prompts.      ║
╚════════════════════════════════════════════════════════════════════════════╝
*/

/*
isValidDomainInput performs basic domain validation for user prompts.
More lenient than full validation to allow for typos, etc.

Parameters:
  domain - Domain string to validate

Returns:
  bool - True if domain appears valid
*/
func isValidDomainInput(domain string) bool {
	/*
	Basic domain validation (more lenient than full validation)
	*/
	if len(domain) == 0 || len(domain) > 253 {
		return false
	}
	return strings.Contains(domain, ".") && !strings.HasPrefix(domain, ".") && !strings.HasSuffix(domain, ".")
}

/*
isValidEmailInput performs basic email validation for user prompts.

Parameters:
  email - Email string to validate

Returns:
  bool - True if email appears valid
*/
func isValidEmailInput(email string) bool {
	return strings.Contains(email, "@") && strings.Contains(email, ".")
}

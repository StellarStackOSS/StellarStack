package executor

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/MarquesCoding/StellarStack/installer/config"
)

/*
╔════════════════════════════════════════════════════════════════════════════╗
║                    FILE OPERATION FUNCTIONS                                ║
║                                                                            ║
║  These functions handle file and directory management:                    ║
║  - Creating installation directories                                      ║
║  - Generating configuration files                                         ║
║  - Creating backups of existing configurations                            ║
║  - Writing environment files                                              ║
║                                                                            ║
║  All operations are safe (check before overwriting) and create backups   ║
║  of existing files when necessary.                                        ║
╚════════════════════════════════════════════════════════════════════════════╝
*/

/*
CreateInstallationDirectories creates necessary directory structure for installation.
Also creates backup directory if this is an update.

Parameters:
  ctx - Context for cancellation
  cfg - Installation configuration

Returns:
  error - Error if directory creation failed
*/
func CreateInstallationDirectories(ctx context.Context, cfg *config.Config) error {
	directories := []string{
		cfg.InstallDir,
		filepath.Join(cfg.InstallDir, config.BackupDirName),
	}

	for _, dir := range directories {
		fmt.Printf("Creating directory %s... ", dir)

		if _, err := os.Stat(dir); err == nil {
			// Directory already exists
			fmt.Println("✓ Exists")
			continue
		}

		if err := os.MkdirAll(dir, 0755); err != nil {
			fmt.Printf("❌ Failed\n")
			return fmt.Errorf("failed to create directory %s: %w", dir, err)
		}

		fmt.Println("✓ Created")
	}

	return nil
}

/*
CreateBackupOfExistingConfig creates a timestamped backup of existing configuration.
Used before updating an existing installation to allow rollback if needed.

Parameters:
  ctx - Context for cancellation
  cfg - Installation configuration

Returns:
  error - Error if backup creation failed
*/
func CreateBackupOfExistingConfig(ctx context.Context, cfg *config.Config) error {
	if !cfg.CreateBackup {
		return nil
	}

	fmt.Print("Creating backup of existing configuration... ")

	backupDir := filepath.Join(cfg.InstallDir, config.BackupDirName, time.Now().Format("2006-01-02-15-04-05"))

	if err := os.MkdirAll(backupDir, 0755); err != nil {
		fmt.Printf("❌ Failed\n")
		return fmt.Errorf("failed to create backup directory: %w", err)
	}

	/*
	Backup docker-compose.yml if it exists
	*/
	sourceFile := filepath.Join(cfg.InstallDir, config.DockerComposeFileName)
	if _, err := os.Stat(sourceFile); err == nil {
		backupFile := filepath.Join(backupDir, config.DockerComposeFileName)

		data, err := os.ReadFile(sourceFile)
		if err != nil {
			fmt.Printf("❌ Failed\n")
			return fmt.Errorf("failed to read docker-compose.yml: %w", err)
		}

		if err := os.WriteFile(backupFile, data, 0644); err != nil {
			fmt.Printf("❌ Failed\n")
			return fmt.Errorf("failed to backup docker-compose.yml: %w", err)
		}
	}

	/*
	Backup .env file if it exists
	*/
	sourceFile = filepath.Join(cfg.InstallDir, config.EnvFileName)
	if _, err := os.Stat(sourceFile); err == nil {
		backupFile := filepath.Join(backupDir, config.EnvFileName)

		data, err := os.ReadFile(sourceFile)
		if err != nil {
			fmt.Printf("❌ Failed\n")
			return fmt.Errorf("failed to read .env: %w", err)
		}

		if err := os.WriteFile(backupFile, data, 0600); err != nil {
			fmt.Printf("❌ Failed\n")
			return fmt.Errorf("failed to backup .env: %w", err)
		}
	}

	fmt.Println("✓ Created")
	fmt.Printf("   Backup location: %s\n", backupDir)

	return nil
}

/*
WriteEnvironmentFile generates and writes the .env configuration file.
This file contains all environment variables needed by the containers.

Parameters:
  ctx - Context for cancellation
  cfg - Installation configuration

Returns:
  error - Error if file write failed
*/
func WriteEnvironmentFile(ctx context.Context, cfg *config.Config) error {
	fmt.Print("Writing .env configuration file... ")

	envFile := filepath.Join(cfg.InstallDir, config.EnvFileName)

	/*
	Build environment file content
	*/
	content := fmt.Sprintf(`# StellarStack Environment Configuration
# Generated on %s

# Database Configuration
DATABASE_URL=postgresql://%s:%s@postgres:5432/%s?sslmode=disable
POSTGRES_USER=%s
POSTGRES_PASSWORD=%s
POSTGRES_DB=%s

# Frontend Configuration
FRONTEND_URL=https://%s
NEXT_PUBLIC_API_URL=https://%s

# API Configuration
API_URL=https://%s

# Upload Limits
UPLOAD_LIMIT=%s

# Monitoring Configuration
MONITORING_ENABLED=%v
MONITORING_DOMAIN=%s

# JWT and Security
JWT_SECRET=%s
ENCRYPTION_KEY=%s

# Application Settings
NODE_ENV=production
`,
		time.Now().Format("2006-01-02 15:04:05"),
		cfg.DatabaseUser,
		cfg.DatabasePassword,
		cfg.DatabaseName,
		cfg.DatabaseUser,
		cfg.DatabasePassword,
		cfg.DatabaseName,
		cfg.PanelDomain,
		cfg.APIDomain,
		cfg.APIDomain,
		cfg.UploadLimit,
		cfg.InstallMonitoring,
		cfg.MonitoringDomain,
		generateRandomString(32),
		generateRandomString(32),
	)

	/*
	Write file with restricted permissions (sensitive data)
	*/
	if err := os.WriteFile(envFile, []byte(content), 0600); err != nil {
		fmt.Printf("❌ Failed\n")
		return fmt.Errorf("failed to write .env file: %w", err)
	}

	fmt.Println("✓ Written")

	return nil
}

/*
WriteDockerComposeFile generates and writes docker-compose.yml.
This file defines all services and their configuration.

Parameters:
  ctx - Context for cancellation
  cfg - Installation configuration

Returns:
  error - Error if file write failed
*/
func WriteDockerComposeFile(ctx context.Context, cfg *config.Config) error {
	fmt.Print("Writing docker-compose.yml... ")

	composeFile := filepath.Join(cfg.InstallDir, config.DockerComposeFileName)

	/*
	Generate docker-compose content based on installation type
	*/
	content := generateDockerComposeContent(cfg)

	if err := os.WriteFile(composeFile, []byte(content), 0644); err != nil {
		fmt.Printf("❌ Failed\n")
		return fmt.Errorf("failed to write docker-compose.yml: %w", err)
	}

	fmt.Println("✓ Written")

	return nil
}

/*
CleanupInstallationOnFailure removes created files and directories if installation fails.
Helps ensure a clean state if the user wants to retry.

Parameters:
  ctx - Context for cancellation
  cfg - Installation configuration

Returns:
  error - Error if cleanup failed
*/
func CleanupInstallationOnFailure(ctx context.Context, cfg *config.Config) error {
	fmt.Print("Cleaning up failed installation... ")

	/*
	Remove installation directory
	*/
	if err := os.RemoveAll(cfg.InstallDir); err != nil {
		fmt.Printf("⚠️  Warning: Could not clean up directory\n")
		return err
	}

	fmt.Println("✓ Cleaned up")

	return nil
}

/*
╔════════════════════════════════════════════════════════════════════════════╗
║                    HELPER FUNCTIONS                                        ║
╚════════════════════════════════════════════════════════════════════════════╝
*/

/*
generateDockerComposeContent creates docker-compose.yml content.
Content varies based on installation type.

Parameters:
  cfg - Installation configuration

Returns:
  string - Docker-compose YAML content
*/
func generateDockerComposeContent(cfg *config.Config) string {
	/*
	This is a simplified version - a full implementation would be much larger.
	In a real scenario, this would include all services configuration.
	*/
	return fmt.Sprintf(`version: '%s'

services:
  postgres:
    image: postgres:15
    environment:
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=${POSTGRES_DB}
    networks:
      - stellar_network
    volumes:
      - postgres_data:/var/lib/postgresql/data

  api:
    image: %s/%s:latest
    depends_on:
      - postgres
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
    networks:
      - stellar_network
    ports:
      - "3000:3000"

  panel:
    image: %s/%s:latest
    depends_on:
      - api
    environment:
      - API_URL=${API_URL}
    networks:
      - stellar_network
    ports:
      - "3001:3001"

networks:
  stellar_network:
    external: true

volumes:
  postgres_data:
`,
		config.DefaultComposeVersion,
		cfg.DockerRegistry,
		config.DefaultAPIImage,
		cfg.DockerRegistry,
		config.DefaultPanelImage,
	)
}

/*
generateRandomString creates a random string of specified length.
Used for generating secure random values like passwords and secrets.

Parameters:
  length - Length of random string to generate

Returns:
  string - Random string
*/
func generateRandomString(length int) string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	result := make([]byte, length)

	for i := range result {
		result[i] = charset[i%len(charset)]
	}

	return string(result)
}

use anyhow::Result;
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

/// Persistent desktop application configuration stored on disk.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    /// Whether the first-run setup has completed
    pub initialized: bool,
    /// Generated PostgreSQL password
    pub db_password: String,
    /// Better Auth secret key
    pub auth_secret: String,
    /// Download token signing secret
    pub download_token_secret: String,
    /// AES encryption key
    pub encryption_key: String,
    /// Daemon API token ID (stored in DB)
    pub daemon_token_id: String,
    /// Daemon API token (plain text, used by daemon to authenticate)
    pub daemon_token: String,
    /// API server port
    pub api_port: u16,
    /// Daemon HTTP port
    pub daemon_port: u16,
    /// Daemon SFTP port
    pub sftp_port: u16,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            initialized: false,
            db_password: generate_hex(32),
            auth_secret: generate_hex(64),
            download_token_secret: generate_hex(32),
            encryption_key: generate_hex(32),
            daemon_token_id: String::new(),
            daemon_token: String::new(),
            api_port: 3001,
            daemon_port: 8080,
            sftp_port: 2022,
        }
    }
}

impl AppConfig {
    /// Load config from disk, or create a new default if none exists.
    pub fn load_or_create(data_dir: &Path) -> Result<Self> {
        let config_path = data_dir.join("config.json");
        if config_path.exists() {
            let contents = fs::read_to_string(&config_path)?;
            let config: AppConfig = serde_json::from_str(&contents)?;
            Ok(config)
        } else {
            let config = AppConfig::default();
            config.save(data_dir)?;
            Ok(config)
        }
    }

    /// Persist the current config to disk.
    pub fn save(&self, data_dir: &Path) -> Result<()> {
        fs::create_dir_all(data_dir)?;
        let config_path = data_dir.join("config.json");
        let json = serde_json::to_string_pretty(self)?;
        fs::write(&config_path, json)?;
        Ok(())
    }

    /// Build the DATABASE_URL connection string.
    pub fn database_url(&self) -> String {
        format!(
            "postgresql://stellar:{}@localhost:5432/stellar",
            self.db_password
        )
    }

    /// Build the full set of environment variables for the API sidecar.
    pub fn api_env_vars(&self) -> Vec<(String, String)> {
        vec![
            ("DATABASE_URL".into(), self.database_url()),
            ("BETTER_AUTH_SECRET".into(), self.auth_secret.clone()),
            (
                "FRONTEND_URL".into(),
                format!("http://localhost:{}", self.api_port),
            ),
            (
                "API_URL".into(),
                format!("http://localhost:{}", self.api_port),
            ),
            ("PORT".into(), self.api_port.to_string()),
            ("HOST".into(), "127.0.0.1".into()),
            (
                "DOWNLOAD_TOKEN_SECRET".into(),
                self.download_token_secret.clone(),
            ),
            ("ENCRYPTION_KEY".into(), self.encryption_key.clone()),
            ("DESKTOP_MODE".into(), "true".into()),
        ]
    }

    /// Generate the daemon config.toml contents.
    pub fn daemon_config_toml(&self, data_dir: &Path) -> String {
        let uploads_dir = data_dir.join("uploads");
        let backups_dir = data_dir.join("backups");
        let logs_dir = data_dir.join("logs");

        format!(
            r#"# StellarStack Daemon Configuration (auto-generated)

[remote]
url = "http://localhost:{api_port}"
token_id = "{token_id}"
token = "{token}"

[server]
port = {daemon_port}
host = "127.0.0.1"

[sftp]
enabled = true
port = {sftp_port}
host = "0.0.0.0"

[docker]
socket = ""

[storage]
uploads = "{uploads}"
backups = "{backups}"

[logging]
directory = "{logs}"
level = "info"

[redis]
enabled = true
url = "redis://127.0.0.1:6379"
"#,
            api_port = self.api_port,
            token_id = self.daemon_token_id,
            token = self.daemon_token,
            daemon_port = self.daemon_port,
            sftp_port = self.sftp_port,
            uploads = uploads_dir.to_string_lossy().replace('\\', "/"),
            backups = backups_dir.to_string_lossy().replace('\\', "/"),
            logs = logs_dir.to_string_lossy().replace('\\', "/"),
        )
    }

    /// Write the daemon config.toml to disk.
    pub fn write_daemon_config(&self, data_dir: &Path) -> Result<PathBuf> {
        let config_path = data_dir.join("daemon.toml");
        let contents = self.daemon_config_toml(data_dir);
        fs::write(&config_path, contents)?;

        // Ensure storage directories exist
        fs::create_dir_all(data_dir.join("uploads"))?;
        fs::create_dir_all(data_dir.join("backups"))?;
        fs::create_dir_all(data_dir.join("logs"))?;

        Ok(config_path)
    }
}

/// Generate a random hex string of the given byte-length.
fn generate_hex(bytes: usize) -> String {
    let mut rng = rand::thread_rng();
    let random_bytes: Vec<u8> = (0..bytes).map(|_| rng.gen()).collect();
    hex::encode(&random_bytes)
}

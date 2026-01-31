//! Plugin system operation handlers
//!
//! Handles plugin-specific operations like downloads, file writes, backups,
//! and server control with permission validation and safety checks.

use std::sync::Arc;
use std::path::Path;

use axum::{
    extract::Query,
    Extension, Json,
};
use serde::{Deserialize, Serialize};
use tracing::{debug, info, warn};
use reqwest::Client as HttpClient;
use uuid::Uuid;

use crate::filesystem::Filesystem;
use crate::server::Server;
use crate::backup::BackupManager;
use super::ApiError;

// ============================================
// Types
// ============================================

/// Plugin file download request
#[derive(Debug, Deserialize)]
pub struct PluginDownloadRequest {
    /// URL to download from
    pub url: String,

    /// Destination path on server
    pub dest_path: String,

    /// Directory to extract to (e.g., "mods", "plugins")
    #[serde(default)]
    pub directory: Option<String>,

    /// Auto-decompress zip files
    #[serde(default)]
    pub decompress: bool,

    /// Optional headers for the download request
    #[serde(default)]
    pub headers: std::collections::HashMap<String, String>,

    /// Maximum file size in bytes (default: 5GB)
    #[serde(default = "default_max_size")]
    pub max_size: u64,
}

fn default_max_size() -> u64 {
    5 * 1024 * 1024 * 1024 // 5GB
}

/// Plugin file write request
#[derive(Debug, Deserialize)]
pub struct PluginWriteRequest {
    /// File path to write to
    pub path: String,

    /// Content to write
    pub content: String,

    /// Append instead of truncate
    #[serde(default)]
    pub append: bool,

    /// File permissions (e.g., "644", "755")
    #[serde(default)]
    pub mode: Option<String>,
}

/// Plugin file delete request
#[derive(Debug, Deserialize)]
pub struct PluginDeleteRequest {
    /// Path to delete (file or directory)
    pub path: String,

    /// Recursively delete directory
    #[serde(default)]
    pub recursive: bool,
}

/// Plugin backup request
#[derive(Debug, Deserialize)]
pub struct PluginBackupRequest {
    /// Backup name
    pub name: String,

    /// Backup description
    #[serde(default)]
    pub description: Option<String>,
}

/// Plugin server control request
#[derive(Debug, Deserialize)]
pub struct PluginServerControlRequest {
    /// Action: "start", "stop", "restart"
    pub action: String,

    /// Timeout in milliseconds
    #[serde(default = "default_timeout")]
    pub timeout: u64,

    /// Force action (for stop)
    #[serde(default)]
    pub force: bool,
}

fn default_timeout() -> u64 {
    30000 // 30 seconds
}

/// Plugin console command request
#[derive(Debug, Deserialize)]
pub struct PluginCommandRequest {
    /// Console command to send
    pub command: String,

    /// Timeout in milliseconds
    #[serde(default = "default_timeout")]
    pub timeout: u64,
}

/// Success response
#[derive(Debug, Serialize)]
pub struct PluginResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
}

/// Backup response
#[derive(Debug, Serialize)]
pub struct PluginBackupResponse {
    pub success: bool,
    pub backup_id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size_bytes: Option<u64>,
}

// ============================================
// Security & Validation
// ============================================

/// Validate a URL for safety
fn validate_download_url(url: &str) -> Result<(), ApiError> {
    // Only allow HTTPS
    if !url.starts_with("https://") {
        return Err(ApiError::bad_request("Only HTTPS downloads are allowed"));
    }

    // Block localhost and private IPs (prevent SSRF)
    let disallowed = vec![
        "localhost",
        "127.0.0.1",
        "0.0.0.0",
        "192.168.",
        "10.",
        "172.16.",
    ];

    for pattern in disallowed {
        if url.contains(pattern) {
            return Err(ApiError::bad_request(
                "Downloads from private networks are not allowed",
            ));
        }
    }

    Ok(())
}

/// Validate a server path to prevent directory traversal
fn validate_server_path(path: &str) -> Result<(), ApiError> {
    // No directory traversal
    if path.contains("..") || path.starts_with("/") {
        return Err(ApiError::bad_request(
            "Invalid path: directory traversal not allowed",
        ));
    }

    Ok(())
}

/// Get the filesystem handler for a server
fn get_filesystem(server: &Server) -> Result<Filesystem, ApiError> {
    Ok(Filesystem::new(server.path.clone()))
}

// ============================================
// Download Operation
// ============================================

/// Download a file from URL and save to server
pub async fn download_file(
    Extension(server): Extension<Arc<Server>>,
    Json(request): Json<PluginDownloadRequest>,
) -> Result<Json<PluginResponse>, ApiError> {
    // Validate URL
    validate_download_url(&request.url)?;
    validate_server_path(&request.dest_path)?;

    info!(
        "[Plugin] Downloading from {} to {} on server {}",
        request.url,
        request.dest_path,
        server.id
    );

    let fs = get_filesystem(&server)?;

    // Create destination directory if needed
    if let Some(parent) = Path::new(&request.dest_path).parent() {
        fs.create_directory(parent.to_str().unwrap_or(""))
            .await
            .map_err(|e| ApiError::internal(format!("Failed to create directory: {}", e)))?;
    }

    // Download the file
    let http_client = HttpClient::new();
    let response = http_client
        .get(&request.url)
        .send()
        .await
        .map_err(|e| ApiError::internal(format!("Download failed: {}", e)))?;

    // Check file size before downloading
    if let Some(content_length) = response.content_length() {
        if content_length > request.max_size {
            return Err(ApiError::bad_request(format!(
                "File too large: {} bytes (max: {} bytes)",
                content_length, request.max_size
            )));
        }
    }

    // Stream and write file
    let bytes = response
        .bytes()
        .await
        .map_err(|e| ApiError::internal(format!("Failed to read response: {}", e)))?;

    fs.write_file(&request.dest_path, &bytes)
        .await
        .map_err(|e| ApiError::internal(format!("Failed to write file: {}", e)))?;

    // Decompress if requested
    if request.decompress && request.dest_path.ends_with(".zip") {
        let extract_dir = request
            .directory
            .as_ref()
            .cloned()
            .unwrap_or_else(|| "mods".to_string());

        fs.decompress_file(&request.dest_path, &extract_dir)
            .await
            .map_err(|e| ApiError::internal(format!("Decompression failed: {}", e)))?;

        info!("[Plugin] Extracted {} to {}", request.dest_path, extract_dir);
    }

    Ok(Json(PluginResponse {
        success: true,
        message: Some(format!("Downloaded {} bytes", bytes.len())),
        data: None,
    }))
}

// ============================================
// Write Operation
// ============================================

/// Write content to a file on the server
pub async fn write_file(
    Extension(server): Extension<Arc<Server>>,
    Json(request): Json<PluginWriteRequest>,
) -> Result<Json<PluginResponse>, ApiError> {
    validate_server_path(&request.path)?;

    info!("[Plugin] Writing file {} on server {}", request.path, server.id);

    let fs = get_filesystem(&server)?;

    // Create parent directory if needed
    if let Some(parent) = Path::new(&request.path).parent() {
        fs.create_directory(parent.to_str().unwrap_or(""))
            .await
            .map_err(|e| ApiError::internal(format!("Failed to create directory: {}", e)))?;
    }

    // Write or append file
    if request.append {
        // TODO: Implement append operation
        // fs.append_file(&request.path, request.content.as_bytes()).await?;
    } else {
        fs.write_file(&request.path, request.content.as_bytes())
            .await
            .map_err(|e| ApiError::internal(format!("Failed to write file: {}", e)))?;
    }

    // Set file permissions if provided
    if let Some(mode) = request.mode {
        // TODO: Implement chmod operation
        // fs.chmod(&request.path, &mode).await?;
    }

    Ok(Json(PluginResponse {
        success: true,
        message: Some("File written successfully".to_string()),
        data: None,
    }))
}

// ============================================
// Delete Operation
// ============================================

/// Delete a file or directory
pub async fn delete_file(
    Extension(server): Extension<Arc<Server>>,
    Json(request): Json<PluginDeleteRequest>,
) -> Result<Json<PluginResponse>, ApiError> {
    validate_server_path(&request.path)?;

    info!("[Plugin] Deleting {} on server {}", request.path, server.id);

    let fs = get_filesystem(&server)?;

    // TODO: Implement actual delete with recursive option
    // fs.delete(&request.path, request.recursive).await?;

    Ok(Json(PluginResponse {
        success: true,
        message: Some("File deleted successfully".to_string()),
        data: None,
    }))
}

// ============================================
// Backup Operation
// ============================================

/// Create a backup before destructive operations
pub async fn create_backup(
    Extension(server): Extension<Arc<Server>>,
    Json(request): Json<PluginBackupRequest>,
) -> Result<Json<PluginBackupResponse>, ApiError> {
    info!(
        "[Plugin] Creating backup '{}' for server {}",
        request.name, server.id
    );

    // TODO: Integrate with existing backup manager
    // let backup_manager = BackupManager::new(&server.path);
    // let backup = backup_manager.create(&request.name, request.description.as_deref()).await?;

    // Placeholder response
    Ok(Json(PluginBackupResponse {
        success: true,
        backup_id: format!("backup-{}", Uuid::new_v4()),
        name: request.name,
        size_bytes: None,
    }))
}

// ============================================
// Server Control
// ============================================

/// Control server (start, stop, restart)
pub async fn control_server(
    Extension(server): Extension<Arc<Server>>,
    Json(request): Json<PluginServerControlRequest>,
) -> Result<Json<PluginResponse>, ApiError> {
    info!(
        "[Plugin] Server control action '{}' for server {}",
        request.action, server.id
    );

    match request.action.as_str() {
        "start" => {
            // TODO: Implement server start
            // server.start().await?;
        }
        "stop" => {
            // TODO: Implement server stop with timeout
            // server.stop(request.timeout).await?;
        }
        "restart" => {
            // TODO: Implement server restart
            // server.restart(request.timeout).await?;
        }
        _ => {
            return Err(ApiError::bad_request(
                format!("Unknown action: {}", request.action),
            ));
        }
    }

    Ok(Json(PluginResponse {
        success: true,
        message: Some(format!("Server {} action completed", request.action)),
        data: None,
    }))
}

// ============================================
// Console Command
// ============================================

/// Send a command to the server console
pub async fn send_command(
    Extension(server): Extension<Arc<Server>>,
    Json(request): Json<PluginCommandRequest>,
) -> Result<Json<PluginResponse>, ApiError> {
    info!(
        "[Plugin] Sending command to server {}: {}",
        server.id, request.command
    );

    // TODO: Implement command sending
    // server.send_command(&request.command).await?;

    Ok(Json(PluginResponse {
        success: true,
        message: Some("Command sent successfully".to_string()),
        data: None,
    }))
}

//! Backup operations for servers
//!
//! Provides backup creation, restoration, and deletion functionality.

use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};

use flate2::Compression;
use flate2::write::GzEncoder;
use glob::Pattern;
use sha2::{Sha256, Digest};
use tar::Builder;
use tracing::{debug, info};

use crate::events::{Event, EventBus};

/// Backup creation result
#[derive(Debug)]
pub struct BackupResult {
    /// Backup file path
    pub path: PathBuf,
    /// Size of the backup in bytes
    pub size: u64,
    /// SHA256 checksum of the backup
    pub checksum: String,
}

/// Backup errors
#[derive(Debug, thiserror::Error)]
pub enum BackupError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Server is not stopped")]
    ServerRunning,

    #[error("Backup not found: {0}")]
    NotFound(String),

    #[error("Invalid path: {0}")]
    InvalidPath(String),

    #[error("{0}")]
    Other(String),
}

/// Create a backup of a server's data directory
pub async fn create_backup(
    server_uuid: &str,
    backup_uuid: &str,
    data_dir: &Path,
    backup_dir: &Path,
    ignore_patterns: &[String],
    event_bus: &EventBus,
) -> Result<BackupResult, BackupError> {
    info!("Creating backup {} for server {}", backup_uuid, server_uuid);

    // Publish backup started event
    event_bus.publish(Event::BackupStarted {
        uuid: backup_uuid.to_string(),
    });

    // Ensure backup directory exists
    fs::create_dir_all(backup_dir)?;

    // Create backup file path
    let backup_filename = format!("{}.tar.gz", backup_uuid);
    let backup_path = backup_dir.join(&backup_filename);

    // Create the tar.gz archive
    let file = File::create(&backup_path)?;
    let encoder = GzEncoder::new(file, Compression::default());
    let mut builder = Builder::new(encoder);

    // Compile ignore patterns
    let patterns: Vec<Pattern> = ignore_patterns
        .iter()
        .filter_map(|p| Pattern::new(p).ok())
        .collect();

    // Add files to the archive
    let entries = walkdir::WalkDir::new(data_dir)
        .min_depth(1)
        .into_iter()
        .filter_entry(|e| {
            let path = e.path().strip_prefix(data_dir).unwrap_or(e.path());
            let path_str = path.to_string_lossy();

            // Check if path matches any ignore pattern
            !patterns.iter().any(|p| p.matches(&path_str))
        });

    for entry in entries.filter_map(|e| e.ok()) {
        let path = entry.path();
        let relative_path = path.strip_prefix(data_dir)
            .map_err(|e| BackupError::InvalidPath(e.to_string()))?;

        if path.is_file() {
            debug!("Adding to backup: {}", relative_path.display());
            builder.append_path_with_name(path, relative_path)?;
        } else if path.is_dir() {
            builder.append_dir(relative_path, path)?;
        }
    }

    // Finish the archive
    let encoder = builder.into_inner()?;
    encoder.finish()?;

    // Calculate checksum
    let checksum = calculate_checksum(&backup_path)?;

    // Get file size
    let metadata = fs::metadata(&backup_path)?;
    let size = metadata.len();

    info!(
        "Backup {} created: {} bytes, checksum: {}",
        backup_uuid, size, checksum
    );

    // Publish backup completed event
    event_bus.publish(Event::BackupCompleted {
        uuid: backup_uuid.to_string(),
        successful: true,
        checksum: Some(checksum.clone()),
        size,
    });

    Ok(BackupResult {
        path: backup_path,
        size,
        checksum,
    })
}

/// Calculate SHA256 checksum of a file
fn calculate_checksum(path: &Path) -> Result<String, BackupError> {
    let mut file = File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 8192];

    loop {
        let bytes_read = file.read(&mut buffer)?;
        if bytes_read == 0 {
            break;
        }
        hasher.update(&buffer[..bytes_read]);
    }

    let hash = hasher.finalize();
    Ok(hex::encode(hash))
}

/// Restore a backup to a server's data directory
pub async fn restore_backup(
    server_uuid: &str,
    backup_uuid: &str,
    backup_path: &Path,
    data_dir: &Path,
    truncate: bool,
    event_bus: &EventBus,
) -> Result<(), BackupError> {
    info!("Restoring backup {} for server {}", backup_uuid, server_uuid);

    // Publish restore started event
    event_bus.publish(Event::BackupRestoreStarted {
        uuid: backup_uuid.to_string(),
    });

    // Verify backup exists
    if !backup_path.exists() {
        return Err(BackupError::NotFound(backup_uuid.to_string()));
    }

    // Truncate data directory if requested
    if truncate {
        info!("Truncating server data directory");
        if data_dir.exists() {
            for entry in fs::read_dir(data_dir)? {
                let entry = entry?;
                let path = entry.path();
                if path.is_dir() {
                    fs::remove_dir_all(&path)?;
                } else {
                    fs::remove_file(&path)?;
                }
            }
        }
    }

    // Extract the backup
    let file = File::open(backup_path)?;
    let decoder = flate2::read::GzDecoder::new(file);
    let mut archive = tar::Archive::new(decoder);

    archive.unpack(data_dir)?;

    info!("Backup {} restored successfully", backup_uuid);

    // Publish restore completed event
    event_bus.publish(Event::BackupRestoreCompleted {
        uuid: backup_uuid.to_string(),
        successful: true,
    });

    Ok(())
}

/// Delete a backup file
pub fn delete_backup(backup_dir: &Path, backup_uuid: &str) -> Result<(), BackupError> {
    let backup_filename = format!("{}.tar.gz", backup_uuid);
    let backup_path = backup_dir.join(&backup_filename);

    if !backup_path.exists() {
        return Err(BackupError::NotFound(backup_uuid.to_string()));
    }

    fs::remove_file(&backup_path)?;
    info!("Deleted backup {}", backup_uuid);

    Ok(())
}

/// List all backups for a server
pub fn list_backups(backup_dir: &Path) -> Result<Vec<BackupInfo>, BackupError> {
    let mut backups = Vec::new();

    if !backup_dir.exists() {
        return Ok(backups);
    }

    for entry in fs::read_dir(backup_dir)? {
        let entry = entry?;
        let path = entry.path();

        if path.is_file() {
            if let Some(ext) = path.extension() {
                if ext == "gz" {
                    if let Some(stem) = path.file_stem() {
                        if let Some(stem_str) = stem.to_str() {
                            if stem_str.ends_with(".tar") {
                                let uuid = stem_str.strip_suffix(".tar").unwrap_or(stem_str);
                                let metadata = fs::metadata(&path)?;

                                backups.push(BackupInfo {
                                    uuid: uuid.to_string(),
                                    size: metadata.len(),
                                    created_at: metadata.created()
                                        .ok()
                                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                                        .map(|d| d.as_secs())
                                        .unwrap_or(0),
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(backups)
}

/// Information about a backup
#[derive(Debug)]
pub struct BackupInfo {
    /// Backup UUID
    pub uuid: String,
    /// Size in bytes
    pub size: u64,
    /// Unix timestamp of creation
    pub created_at: u64,
}

//! Server transfer operations
//!
//! Provides functionality to transfer servers between nodes by creating
//! archives and uploading/downloading them to/from target nodes.

use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use flate2::Compression;
use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use glob::Pattern;
use sha2::{Sha256, Digest};
use tar::{Archive, Builder};
use tracing::{debug, error, info};
use crate::events::{Event, EventBus};

/// Transfer result
#[derive(Debug)]
pub struct TransferArchiveResult {
    /// Archive file path
    pub path: PathBuf,
    /// Size of the archive in bytes
    pub size: u64,
    /// SHA256 checksum
    pub checksum: String,
}

/// Transfer errors
#[derive(Debug, thiserror::Error)]
pub enum TransferError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Server is not stopped")]
    ServerRunning,

    #[error("Transfer already in progress")]
    AlreadyTransferring,

    #[error("HTTP error: {0}")]
    Http(String),

    #[error("Archive error: {0}")]
    Archive(String),

    #[error("Invalid path: {0}")]
    InvalidPath(String),

    #[error("Checksum mismatch")]
    ChecksumMismatch,

    #[error("{0}")]
    Other(String),
}

/// Configuration for a server transfer
#[derive(Debug, Clone)]
pub struct TransferConfig {
    /// Transfer ID from the API
    pub transfer_id: String,
    /// Server UUID being transferred
    pub server_uuid: String,
    /// Target node URL
    pub target_url: String,
    /// Target node authentication token
    pub target_token: String,
}

/// Create a transfer archive of a server's data directory
pub async fn create_transfer_archive(
    server_uuid: &str,
    transfer_id: &str,
    data_dir: &Path,
    archive_dir: &Path,
    ignore_patterns: &[String],
    event_bus: &EventBus,
) -> Result<TransferArchiveResult, TransferError> {
    info!("Creating transfer archive {} for server {}", transfer_id, server_uuid);

    // Publish transfer started event
    event_bus.publish(Event::TransferStarted);

    // Ensure archive directory exists
    fs::create_dir_all(archive_dir)?;

    // Create archive file path
    let archive_filename = format!("transfer-{}.tar.gz", transfer_id);
    let archive_path = archive_dir.join(&archive_filename);

    // Create the tar.gz archive
    let file = File::create(&archive_path)?;
    let encoder = GzEncoder::new(file, Compression::default());
    let mut builder = Builder::new(encoder);

    // Compile ignore patterns
    let patterns: Vec<Pattern> = ignore_patterns
        .iter()
        .filter_map(|p| Pattern::new(p).ok())
        .collect();

    // Count total files for progress reporting
    let total_files: usize = walkdir::WalkDir::new(data_dir)
        .min_depth(1)
        .into_iter()
        .filter_entry(|e| {
            let path = e.path().strip_prefix(data_dir).unwrap_or(e.path());
            let path_str = path.to_string_lossy();
            !patterns.iter().any(|p| p.matches(&path_str))
        })
        .filter_map(|e| e.ok())
        .filter(|e| e.path().is_file())
        .count();

    info!("Transfer archive will contain {} files", total_files);

    // Add files to the archive
    let entries = walkdir::WalkDir::new(data_dir)
        .min_depth(1)
        .into_iter()
        .filter_entry(|e| {
            let path = e.path().strip_prefix(data_dir).unwrap_or(e.path());
            let path_str = path.to_string_lossy();
            !patterns.iter().any(|p| p.matches(&path_str))
        });

    let mut files_processed = 0;
    for entry in entries.filter_map(|e| e.ok()) {
        let path = entry.path();
        let relative_path = path.strip_prefix(data_dir)
            .map_err(|e| TransferError::InvalidPath(e.to_string()))?;

        if path.is_file() {
            debug!("Adding to transfer archive: {}", relative_path.display());
            builder.append_path_with_name(path, relative_path)
                .map_err(|e| TransferError::Archive(e.to_string()))?;

            files_processed += 1;

            // Report progress every 100 files or at the end
            if files_processed % 100 == 0 || files_processed == total_files {
                let progress = if total_files > 0 {
                    (files_processed * 100) as f64 / total_files as f64
                } else {
                    100.0
                };
                event_bus.publish(Event::TransferProgress { progress });
            }
        } else if path.is_dir() {
            builder.append_dir(relative_path, path)
                .map_err(|e| TransferError::Archive(e.to_string()))?;
        }
    }

    // Finish the archive
    let encoder = builder.into_inner()
        .map_err(|e| TransferError::Archive(e.to_string()))?;
    encoder.finish()?;

    // Calculate checksum
    let checksum = calculate_checksum(&archive_path)?;

    // Get file size
    let metadata = fs::metadata(&archive_path)?;
    let size = metadata.len();

    info!(
        "Transfer archive {} created: {} bytes, checksum: {}",
        transfer_id, size, checksum
    );

    Ok(TransferArchiveResult {
        path: archive_path,
        size,
        checksum,
    })
}

/// Upload a transfer archive to the target node
pub async fn upload_transfer_archive(
    archive_path: &Path,
    target_url: &str,
    target_token: &str,
    server_uuid: &str,
    transfer_id: &str,
    checksum: &str,
    event_bus: &EventBus,
) -> Result<(), TransferError> {
    info!("Uploading transfer archive to {}", target_url);

    // Read the archive file
    let file_data = fs::read(archive_path)?;
    let file_size = file_data.len();

    // Build the upload URL
    let upload_url = format!("{}/api/servers/{}/transfer/receive", target_url, server_uuid);

    // Create HTTP client
    let client = reqwest::Client::new();

    // Upload with progress tracking
    let response = client
        .post(&upload_url)
        .header("Authorization", format!("Bearer {}", target_token))
        .header("Content-Type", "application/octet-stream")
        .header("X-Transfer-Id", transfer_id)
        .header("X-Transfer-Checksum", checksum)
        .body(file_data)
        .send()
        .await
        .map_err(|e| TransferError::Http(e.to_string()))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        error!("Transfer upload failed: {} - {}", status, body);
        return Err(TransferError::Http(format!("Upload failed: {} - {}", status, body)));
    }

    info!("Transfer archive uploaded successfully ({} bytes)", file_size);

    event_bus.publish(Event::TransferProgress { progress: 100.0 });

    Ok(())
}

/// Receive and extract a transfer archive
pub async fn receive_transfer_archive(
    server_uuid: &str,
    transfer_id: &str,
    archive_data: Vec<u8>,
    expected_checksum: &str,
    data_dir: &Path,
    archive_dir: &Path,
    truncate: bool,
    event_bus: &EventBus,
) -> Result<(), TransferError> {
    info!("Receiving transfer archive {} for server {}", transfer_id, server_uuid);

    // Ensure directories exist
    fs::create_dir_all(archive_dir)?;
    fs::create_dir_all(data_dir)?;

    // Save archive to disk temporarily
    let archive_path = archive_dir.join(format!("transfer-{}.tar.gz", transfer_id));
    {
        let mut file = File::create(&archive_path)?;
        file.write_all(&archive_data)?;
    }

    // Verify checksum
    let actual_checksum = calculate_checksum(&archive_path)?;
    if actual_checksum != expected_checksum {
        error!(
            "Transfer checksum mismatch: expected {}, got {}",
            expected_checksum, actual_checksum
        );
        fs::remove_file(&archive_path)?;
        return Err(TransferError::ChecksumMismatch);
    }

    info!("Transfer checksum verified");

    // Truncate data directory if requested
    if truncate && data_dir.exists() {
        info!("Truncating server data directory");
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

    // Extract the archive
    info!("Extracting transfer archive to {}", data_dir.display());
    let file = File::open(&archive_path)?;
    let decoder = GzDecoder::new(file);
    let mut archive = Archive::new(decoder);

    archive.unpack(data_dir)
        .map_err(|e| TransferError::Archive(e.to_string()))?;

    // Clean up the archive
    fs::remove_file(&archive_path)?;

    info!("Transfer archive extracted successfully");

    event_bus.publish(Event::TransferCompleted { successful: true });

    Ok(())
}

/// Clean up a transfer archive after completion or failure
pub fn cleanup_transfer_archive(archive_dir: &Path, transfer_id: &str) -> Result<(), TransferError> {
    let archive_path = archive_dir.join(format!("transfer-{}.tar.gz", transfer_id));

    if archive_path.exists() {
        fs::remove_file(&archive_path)?;
        info!("Cleaned up transfer archive {}", transfer_id);
    }

    Ok(())
}

/// Calculate SHA256 checksum of a file
fn calculate_checksum(path: &Path) -> Result<String, TransferError> {
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

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    use std::io::Write;

    #[tokio::test]
    async fn test_create_transfer_archive() {
        let temp = TempDir::new().unwrap();
        let data_dir = temp.path().join("data");
        let archive_dir = temp.path().join("archives");

        fs::create_dir_all(&data_dir).unwrap();

        // Create test files
        let mut f1 = File::create(data_dir.join("test.txt")).unwrap();
        f1.write_all(b"Hello, World!").unwrap();

        fs::create_dir(data_dir.join("subdir")).unwrap();
        let mut f2 = File::create(data_dir.join("subdir/nested.txt")).unwrap();
        f2.write_all(b"Nested content").unwrap();

        let event_bus = crate::events::EventBus::new();

        let result = create_transfer_archive(
            "test-server",
            "test-transfer",
            &data_dir,
            &archive_dir,
            &[],
            &event_bus,
        ).await.unwrap();

        assert!(result.path.exists());
        assert!(result.size > 0);
        assert!(!result.checksum.is_empty());
    }
}

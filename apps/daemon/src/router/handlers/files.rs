//! File operation handlers

use std::sync::Arc;

use axum::{
    extract::Query,
    Extension, Json,
};
use serde::{Deserialize, Serialize};
use tracing::{debug, info, warn};

use crate::filesystem::{FileInfo, Filesystem};
use crate::server::Server;
use super::ApiError;

// url crate re-used from Cargo.toml dependency

/// List files request
#[derive(Debug, Deserialize)]
pub struct ListFilesQuery {
    #[serde(default)]
    pub directory: String,
}

/// List files in a directory
pub async fn list_files(
    Extension(server): Extension<Arc<Server>>,
    Query(query): Query<ListFilesQuery>,
) -> Result<Json<Vec<FileInfo>>, ApiError> {
    let fs = get_filesystem(&server)?;
    let files = fs.list_directory(&query.directory).await?;
    Ok(Json(files))
}

/// Read file request
#[derive(Debug, Deserialize)]
pub struct ReadFileQuery {
    pub file: String,
}

/// Read file contents
pub async fn read_file(
    Extension(server): Extension<Arc<Server>>,
    Query(query): Query<ReadFileQuery>,
) -> Result<String, ApiError> {
    let fs = get_filesystem(&server)?;
    let contents = fs.read_file_string(&query.file).await?;
    Ok(contents)
}

/// Write file request
#[derive(Debug, Deserialize)]
pub struct WriteFileRequest {
    pub file: String,
    pub content: String,
}

/// Write file contents
pub async fn write_file(
    Extension(server): Extension<Arc<Server>>,
    Json(request): Json<WriteFileRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let fs = get_filesystem(&server)?;
    fs.write_file(&request.file, request.content.as_bytes()).await?;

    Ok(Json(serde_json::json!({
        "success": true
    })))
}

/// Create file or directory request
#[derive(Debug, Deserialize)]
pub struct CreateFileRequest {
    pub path: String,
    #[serde(rename = "type")]
    pub file_type: String,
    #[serde(default)]
    pub content: Option<String>,
}

/// Create a file or directory
pub async fn create_file(
    Extension(server): Extension<Arc<Server>>,
    Json(request): Json<CreateFileRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let fs = get_filesystem(&server)?;

    match request.file_type.as_str() {
        "directory" => {
            fs.create_directory(&request.path).await?;
            Ok(Json(serde_json::json!({
                "success": true
            })))
        }
        "file" => {
            let content = request.content.as_deref().unwrap_or("");
            fs.write_file(&request.path, content.as_bytes()).await?;
            Ok(Json(serde_json::json!({
                "success": true
            })))
        }
        _ => Err(ApiError::bad_request(format!(
            "Invalid type '{}'. Must be 'file' or 'directory'",
            request.file_type
        ))),
    }
}

/// Create directory request
#[derive(Debug, Deserialize)]
pub struct CreateDirectoryRequest {
    pub name: String,
    #[serde(default)]
    pub root: String,
}

/// Create a directory
pub async fn create_directory(
    Extension(server): Extension<Arc<Server>>,
    Json(request): Json<CreateDirectoryRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let fs = get_filesystem(&server)?;

    let path = if request.root.is_empty() {
        request.name
    } else {
        format!("{}/{}", request.root.trim_end_matches('/'), request.name)
    };

    fs.create_directory(&path).await?;

    Ok(Json(serde_json::json!({
        "success": true
    })))
}

/// Rename file request
#[derive(Debug, Deserialize)]
pub struct RenameFileRequest {
    pub from: String,
    pub to: String,
    #[serde(default)]
    pub root: String,
}

/// Rename a file or directory
pub async fn rename_file(
    Extension(server): Extension<Arc<Server>>,
    Json(request): Json<RenameFileRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let fs = get_filesystem(&server)?;

    let from = if request.root.is_empty() {
        request.from
    } else {
        format!("{}/{}", request.root.trim_end_matches('/'), request.from)
    };

    let to = if request.root.is_empty() {
        request.to
    } else {
        format!("{}/{}", request.root.trim_end_matches('/'), request.to)
    };

    fs.rename(&from, &to).await?;

    Ok(Json(serde_json::json!({
        "success": true
    })))
}

/// Copy file request
#[derive(Debug, Deserialize)]
pub struct CopyFileRequest {
    pub location: String,
}

/// Copy a file or directory
pub async fn copy_file(
    Extension(server): Extension<Arc<Server>>,
    Json(request): Json<CopyFileRequest>,
) -> Result<Json<CopyFileResponse>, ApiError> {
    let fs = get_filesystem(&server)?;
    let new_name = fs.copy(&request.location).await?;

    Ok(Json(CopyFileResponse { name: new_name }))
}

#[derive(Debug, Serialize)]
pub struct CopyFileResponse {
    pub name: String,
}

/// Delete files request
#[derive(Debug, Deserialize)]
pub struct DeleteFilesRequest {
    pub files: Vec<String>,
    #[serde(default)]
    pub root: String,
}

/// Delete files or directories
pub async fn delete_files(
    Extension(server): Extension<Arc<Server>>,
    Json(request): Json<DeleteFilesRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let fs = get_filesystem(&server)?;

    for file in request.files {
        let path = if request.root.is_empty() {
            file
        } else {
            format!("{}/{}", request.root.trim_end_matches('/'), file)
        };

        fs.delete(&path).await?;
    }

    Ok(Json(serde_json::json!({
        "success": true
    })))
}

/// Compress files request
#[derive(Debug, Deserialize)]
pub struct CompressFilesRequest {
    pub files: Vec<String>,
    #[serde(default)]
    pub root: String,
}

/// Compress files into an archive
pub async fn compress_files(
    Extension(server): Extension<Arc<Server>>,
    Json(request): Json<CompressFilesRequest>,
) -> Result<Json<FileInfo>, ApiError> {
    let fs = get_filesystem(&server)?;

    let root = if request.root.is_empty() {
        ".".to_string()
    } else {
        request.root
    };

    let info = fs.compress(&root, request.files).await?;

    Ok(Json(info))
}

/// Decompress file request
#[derive(Debug, Deserialize)]
pub struct DecompressFileRequest {
    pub file: String,
    #[serde(default)]
    pub root: String,
}

/// Decompress an archive
pub async fn decompress_file(
    Extension(server): Extension<Arc<Server>>,
    Json(request): Json<DecompressFileRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let fs = get_filesystem(&server)?;

    let destination = if request.root.is_empty() {
        ".".to_string()
    } else {
        request.root
    };

    fs.decompress(&request.file, &destination).await?;

    Ok(Json(serde_json::json!({
        "success": true
    })))
}

/// Chmod request
#[derive(Debug, Deserialize)]
pub struct ChmodRequest {
    pub files: Vec<ChmodEntry>,
    #[serde(default)]
    pub root: String,
}

#[derive(Debug, Deserialize)]
pub struct ChmodEntry {
    pub file: String,
    pub mode: u32,
}

/// Change file permissions
pub async fn chmod_file(
    Extension(server): Extension<Arc<Server>>,
    Json(request): Json<ChmodRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let fs = get_filesystem(&server)?;

    for entry in request.files {
        let path = if request.root.is_empty() {
            entry.file
        } else {
            format!("{}/{}", request.root.trim_end_matches('/'), entry.file)
        };

        fs.chmod(&path, entry.mode).await?;
    }

    Ok(Json(serde_json::json!({
        "success": true
    })))
}

/// Pull file from URL request
#[derive(Debug, Deserialize)]
pub struct PullFileRequest {
    /// The remote URL to download from
    pub url: String,
    /// Target directory (relative to server root)
    #[serde(default)]
    pub directory: String,
    /// Optional filename override; if not set, derived from URL or Content-Disposition
    pub filename: Option<String>,
    /// Whether to decompress the downloaded file (supports .tar.gz, .zip, .tar)
    #[serde(default)]
    pub decompress: bool,
}

#[derive(Debug, Serialize)]
pub struct PullFileResponse {
    pub success: bool,
    pub path: String,
    pub size: u64,
}

/// Download a file from a remote URL into the server's filesystem
pub async fn pull_file(
    Extension(server): Extension<Arc<Server>>,
    Json(request): Json<PullFileRequest>,
) -> Result<Json<PullFileResponse>, ApiError> {
    // Validate URL
    let url: url::Url = request.url.parse().map_err(|e| {
        ApiError::bad_request(format!("Invalid URL: {}", e))
    })?;

    // Only allow http/https
    match url.scheme() {
        "http" | "https" => {}
        scheme => {
            return Err(ApiError::bad_request(format!(
                "Unsupported URL scheme '{}'. Only http and https are allowed.",
                scheme
            )));
        }
    }

    info!("Pulling file from URL: {} into directory: {}", url, request.directory);

    // Perform the download
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::limited(10))
        .timeout(std::time::Duration::from_secs(600))
        .build()
        .map_err(|e| ApiError::internal(format!("Failed to create HTTP client: {}", e)))?;

    let response = client.get(url.clone()).send().await.map_err(|e| {
        ApiError::internal(format!("Failed to download file: {}", e))
    })?;

    if !response.status().is_success() {
        return Err(ApiError::internal(format!(
            "Download failed with status: {}",
            response.status()
        )));
    }

    // Determine filename
    let filename = request.filename.unwrap_or_else(|| {
        // Try Content-Disposition header first
        if let Some(cd) = response.headers().get(reqwest::header::CONTENT_DISPOSITION) {
            if let Ok(cd_str) = cd.to_str() {
                // Parse filename from Content-Disposition: attachment; filename="foo.jar"
                if let Some(idx) = cd_str.find("filename=") {
                    let name = &cd_str[idx + 9..];
                    let name = name.trim_matches('"').trim_matches('\'');
                    if !name.is_empty() {
                        return name.to_string();
                    }
                }
            }
        }

        // Fall back to last URL path segment
        url.path_segments()
            .and_then(|segments| segments.last())
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string())
            .unwrap_or_else(|| "download".to_string())
    });

    // Build target path
    let target_path = if request.directory.is_empty() {
        filename.clone()
    } else {
        format!("{}/{}", request.directory.trim_end_matches('/'), filename)
    };

    // Read response body
    let bytes = response.bytes().await.map_err(|e| {
        ApiError::internal(format!("Failed to read download response: {}", e))
    })?;
    let size = bytes.len() as u64;

    let fs = get_filesystem(&server)?;

    // Write the file
    fs.write_file(&target_path, &bytes).await?;

    info!("Downloaded {} bytes to {}", size, target_path);

    // Optionally decompress
    if request.decompress {
        let dest_dir = if request.directory.is_empty() {
            ".".to_string()
        } else {
            request.directory.clone()
        };

        info!("Decompressing {} to {}", target_path, dest_dir);
        fs.decompress(&target_path, &dest_dir).await?;

        // Delete the archive after extraction
        fs.delete(&target_path).await?;
        info!("Decompressed and cleaned up archive {}", target_path);
    }

    Ok(Json(PullFileResponse {
        success: true,
        path: target_path,
        size,
    }))
}

/// Helper to get filesystem for a server
fn get_filesystem(server: &Server) -> Result<Filesystem, ApiError> {
    let config = server.config();

    Filesystem::new(
        server.data_dir().clone(),
        config.disk_bytes(),
        config.egg.file_denylist.clone(),
    ).map_err(|e| ApiError::internal(e.to_string()))
}

/// Disk usage response
#[derive(Debug, Serialize)]
pub struct DiskUsageResponse {
    pub used_bytes: u64,
    pub limit_bytes: u64,
    pub path: String,
}

/// Get disk usage for the server
pub async fn disk_usage(
    Extension(server): Extension<Arc<Server>>,
) -> Result<Json<DiskUsageResponse>, ApiError> {
    let fs = get_filesystem(&server)?;
    let data_dir = server.data_dir();

    // Calculate actual disk usage
    let used = match fs.disk_usage().calculate(&data_dir).await {
        Ok(size) => {
            debug!("Successfully calculated disk usage for {:?}: {} bytes", data_dir, size);
            size
        }
        Err(e) => {
            warn!("Failed to calculate disk usage for {:?}: {}", data_dir, e);
            0
        }
    };

    let limit = server.config().disk_bytes();

    Ok(Json(DiskUsageResponse {
        used_bytes: used,
        limit_bytes: limit,
        path: "/".to_string(),
    }))
}

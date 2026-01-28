//! File upload handler

use std::sync::Arc;
use axum::{
    extract::{Multipart, Query, State},
    Extension, Json,
};
use serde::Deserialize;
use tracing::debug;

use super::super::AppState;
use super::ApiError;
use crate::filesystem::Filesystem;
use crate::server::Server;

/// Upload file query parameters
#[derive(Debug, Deserialize)]
pub struct UploadFileQuery {
    /// JWT token for authentication (legacy)
    pub token: Option<String>,
    /// Server UUID (when using Bearer auth)
    pub server: Option<String>,
    /// Directory to upload to
    #[serde(default)]
    pub directory: String,
}

/// Upload claims from JWT
#[derive(Debug, serde::Deserialize)]
pub struct UploadClaims {
    pub server_uuid: String,
    pub directory: Option<String>,
    pub exp: usize,
}

/// Upload a file to a server
pub async fn upload_file(
    State(state): State<AppState>,
    Query(query): Query<UploadFileQuery>,
    mut multipart: Multipart,
) -> Result<Json<serde_json::Value>, ApiError> {
    // Determine server_uuid from either token or direct param
    let server_uuid = if let Some(token) = &query.token {
        // Legacy: JWT token auth
        let claims = validate_upload_token(token, &state.config.remote.token)
            .map_err(|e| ApiError::forbidden(e))?;
        claims.server_uuid
    } else if let Some(server) = &query.server {
        // Direct server param (requires Bearer auth from middleware)
        server.clone()
    } else {
        return Err(ApiError::bad_request("Either 'token' or 'server' parameter required"));
    };

    // Get server
    let server = state.manager.get(&server_uuid)
        .ok_or_else(|| ApiError::not_found("Server not found"))?;

    // Get filesystem
    let config = server.config();
    let fs = Filesystem::new(
        server.data_dir().clone(),
        config.disk_bytes(),
        config.egg.file_denylist.clone(),
    ).map_err(|e| ApiError::internal(e.to_string()))?;

    // Determine upload directory
    let directory = if query.directory.is_empty() {
        String::new()
    } else {
        query.directory.clone()
    };

    let mut uploaded_files = Vec::new();

    // Process multipart form
    while let Some(field) = multipart.next_field().await
        .map_err(|e| ApiError::bad_request(e.to_string()))?
    {
        // Skip fields without filenames (non-file fields like "directory")
        let filename = match field.file_name() {
            Some(name) => name.to_string(),
            None => {
                debug!("Skipping multipart field '{}' (not a file)", field.name().unwrap_or("unknown"));
                continue;
            }
        };

        let content_type = field.content_type()
            .map(|s| s.to_string())
            .unwrap_or_else(|| "application/octet-stream".to_string());

        // Build file path
        let file_path = if directory.is_empty() {
            filename.clone()
        } else {
            format!("{}/{}", directory.trim_end_matches('/'), filename)
        };

        // Read file data
        let data = field.bytes().await
            .map_err(|e| ApiError::bad_request(e.to_string()))?;

        // Check disk space before writing
        fs.disk_usage().has_space_for(data.len() as u64)?;

        // Write file
        fs.write_file(&file_path, &data).await?;

        uploaded_files.push(serde_json::json!({
            "name": filename,
            "size": data.len(),
            "mime_type": content_type,
        }));
    }

    // Ensure at least one file was uploaded
    if uploaded_files.is_empty() {
        return Err(ApiError::bad_request("No files were uploaded. All multipart fields must be files with filenames."));
    }

    Ok(Json(serde_json::json!({
        "success": true,
        "files": uploaded_files
    })))
}

/// Upload file query parameters for authenticated endpoint
#[derive(Debug, Deserialize)]
pub struct AuthenticatedUploadQuery {
    /// Directory to upload to
    #[serde(default)]
    pub directory: String,
}

/// Upload file via authenticated endpoint (server extracted from middleware)
pub async fn authenticated_upload_file(
    Extension(server): Extension<Arc<Server>>,
    Query(query): Query<AuthenticatedUploadQuery>,
    mut multipart: Multipart,
) -> Result<Json<serde_json::Value>, ApiError> {
    // Get filesystem
    let config = server.config();
    let fs = Filesystem::new(
        server.data_dir().clone(),
        config.disk_bytes(),
        config.egg.file_denylist.clone(),
    ).map_err(|e| ApiError::internal(e.to_string()))?;

    // Determine upload directory
    let directory = if query.directory.is_empty() {
        String::new()
    } else {
        query.directory.clone()
    };

    let mut uploaded_files = Vec::new();

    // Process multipart form
    while let Some(field) = multipart.next_field().await
        .map_err(|e| ApiError::bad_request(e.to_string()))?
    {
        // Skip fields without filenames (non-file fields like "directory")
        let filename = match field.file_name() {
            Some(name) => name.to_string(),
            None => {
                debug!("Skipping multipart field '{}' (not a file)", field.name().unwrap_or("unknown"));
                continue;
            }
        };

        let content_type = field.content_type()
            .map(|s| s.to_string())
            .unwrap_or_else(|| "application/octet-stream".to_string());

        // Build file path
        let file_path = if directory.is_empty() {
            filename.clone()
        } else {
            format!("{}/{}", directory.trim_end_matches('/'), filename)
        };

        // Read file data
        let data = field.bytes().await
            .map_err(|e| ApiError::bad_request(e.to_string()))?;

        // Check disk space before writing
        fs.disk_usage().has_space_for(data.len() as u64)?;

        // Write file
        fs.write_file(&file_path, &data).await?;

        debug!("Uploaded file: {} ({} bytes)", file_path, data.len());

        uploaded_files.push(serde_json::json!({
            "name": filename,
            "size": data.len(),
            "mime_type": content_type,
        }));
    }

    // Ensure at least one file was uploaded
    if uploaded_files.is_empty() {
        return Err(ApiError::bad_request("No files were uploaded. All multipart fields must be files with filenames."));
    }

    Ok(Json(serde_json::json!({
        "success": true,
        "files": uploaded_files
    })))
}

/// Upload file query parameters for authenticated endpoint
#[derive(Debug, Deserialize)]
pub struct AuthenticatedUploadQuery {
    /// Directory to upload to
    #[serde(default)]
    pub directory: String,
}

/// Upload file via authenticated endpoint (server extracted from middleware)
pub async fn authenticated_upload_file(
    Extension(server): Extension<Arc<Server>>,
    Query(query): Query<AuthenticatedUploadQuery>,
    mut multipart: Multipart,
) -> Result<Json<serde_json::Value>, ApiError> {
    // Get filesystem
    let config = server.config();
    let fs = Filesystem::new(
        server.data_dir().clone(),
        config.disk_bytes(),
        config.egg.file_denylist.clone(),
    ).map_err(|e| ApiError::internal(e.to_string()))?;

    // Determine upload directory
    let directory = if query.directory.is_empty() {
        String::new()
    } else {
        query.directory.clone()
    };

    let mut uploaded_files = Vec::new();

    // Process multipart form
    while let Some(field) = multipart.next_field().await
        .map_err(|e| ApiError::bad_request(e.to_string()))?
    {
        let filename = field.file_name()
            .map(|s| s.to_string())
            .ok_or_else(|| ApiError::bad_request("Missing filename"))?;

        let content_type = field.content_type()
            .map(|s| s.to_string())
            .unwrap_or_else(|| "application/octet-stream".to_string());

        // Build file path
        let file_path = if directory.is_empty() {
            filename.clone()
        } else {
            format!("{}/{}", directory.trim_end_matches('/'), filename)
        };

        // Read file data
        let data = field.bytes().await
            .map_err(|e| ApiError::bad_request(e.to_string()))?;

        // Check disk space before writing
        fs.disk_usage().has_space_for(data.len() as u64)?;

        // Write file
        fs.write_file(&file_path, &data).await?;

        debug!("Uploaded file: {} ({} bytes)", file_path, data.len());

        uploaded_files.push(serde_json::json!({
            "name": filename,
            "size": data.len(),
            "mime_type": content_type,
        }));
    }

    Ok(Json(serde_json::json!({
        "success": true,
        "files": uploaded_files
    })))
}

/// Validate an upload token
fn validate_upload_token(token: &str, secret: &str) -> Result<UploadClaims, &'static str> {
    use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};

    let validation = Validation::new(Algorithm::HS256);
    let key = DecodingKey::from_secret(secret.as_bytes());

    let token_data = decode::<UploadClaims>(token, &key, &validation)
        .map_err(|_| "Invalid token")?;

    // Check expiration
    let now = chrono::Utc::now().timestamp() as usize;
    if token_data.claims.exp < now {
        return Err("Token expired");
    }

    Ok(token_data.claims)
}

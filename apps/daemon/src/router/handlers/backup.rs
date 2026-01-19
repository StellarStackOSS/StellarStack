//! Backup handlers

use std::sync::Arc;

use axum::{
    extract::{Path, State},
    Extension, Json,
};
use serde::{Deserialize, Serialize};
use tracing::{error, info};

use crate::router::AppState;
use crate::server::{self, Server, BackupCompressionLevel};
use super::ApiError;

/// Backup list response
#[derive(Debug, Serialize)]
pub struct BackupListResponse {
    pub backups: Vec<BackupInfo>,
}

/// Backup information
#[derive(Debug, Serialize)]
pub struct BackupInfo {
    pub uuid: String,
    pub size: u64,
    pub created_at: u64,
}

/// List backups
pub async fn list_backups(
    State(state): State<AppState>,
    Extension(server): Extension<Arc<Server>>,
) -> Result<Json<BackupListResponse>, ApiError> {
    let backup_dir = state.config.system.backup_directory.join(server.uuid());

    info!(
        "Listing backups for server {} in directory: {:?}",
        server.uuid(),
        backup_dir
    );

    match server::list_backups(&backup_dir) {
        Ok(backups) => {
            info!("Found {} backups for server {}", backups.len(), server.uuid());
            let response = BackupListResponse {
                backups: backups
                    .into_iter()
                    .map(|b| BackupInfo {
                        uuid: b.uuid,
                        size: b.size,
                        created_at: b.created_at,
                    })
                    .collect(),
            };
            Ok(Json(response))
        }
        Err(e) => {
            error!("Failed to list backups for server {}: {}", server.uuid(), e);
            Err(ApiError::internal(e.to_string()))
        }
    }
}

/// Create backup request
#[derive(Debug, Deserialize)]
pub struct CreateBackupRequest {
    pub uuid: String,
    #[serde(default)]
    pub ignore: Vec<String>,
}

/// Create backup response
#[derive(Debug, Serialize)]
pub struct CreateBackupResponse {
    pub success: bool,
    pub checksum: Option<String>,
    pub size: u64,
}

/// Create a backup
pub async fn create_backup(
    State(state): State<AppState>,
    Extension(server): Extension<Arc<Server>>,
    Json(request): Json<CreateBackupRequest>,
) -> Result<Json<CreateBackupResponse>, ApiError> {
    let server_uuid = server.uuid();
    let backup_uuid = request.uuid;
    let data_dir = server.data_dir();
    let backup_dir = state.config.system.backup_directory.join(&server_uuid);
    let event_bus = server.events();
    let rate_limit = state.config.system.backup_rate_limit_mibps;

    info!(
        "Creating backup {} for server {} (rate_limit: {:?} MiB/s)",
        backup_uuid, server_uuid, rate_limit
    );

    // Run backup creation with configured compression and rate limiting
    let result = server::create_backup_with_config(
        &server_uuid,
        &backup_uuid,
        data_dir,
        &backup_dir,
        &request.ignore,
        event_bus,
        BackupCompressionLevel::default(),
        rate_limit,
    )
    .await;

    match result {
        Ok(backup_result) => Ok(Json(CreateBackupResponse {
            success: true,
            checksum: Some(backup_result.checksum),
            size: backup_result.size,
        })),
        Err(e) => {
            error!("Backup creation failed: {}", e);
            Err(ApiError::internal(e.to_string()))
        }
    }
}

/// Restore backup request
#[derive(Debug, Deserialize)]
pub struct RestoreBackupRequest {
    pub uuid: String,
    #[serde(default)]
    pub truncate: bool,
}

/// Restore from backup
pub async fn restore_backup(
    State(state): State<AppState>,
    Extension(server): Extension<Arc<Server>>,
    Json(request): Json<RestoreBackupRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    // Check if server is running
    if server.process_state() != crate::events::ProcessState::Offline {
        return Err(ApiError::bad_request(
            "Server must be stopped before restoring a backup",
        ));
    }

    let server_uuid = server.uuid();
    let backup_uuid = &request.uuid;
    let backup_path = state
        .config
        .system
        .backup_directory
        .join(&server_uuid)
        .join(format!("{}.tar.gz", backup_uuid));
    let data_dir = server.data_dir();
    let event_bus = server.events();

    info!("Restoring backup {} for server {}", backup_uuid, server_uuid);

    let result = server::restore_backup(
        &server_uuid,
        backup_uuid,
        &backup_path,
        data_dir,
        request.truncate,
        event_bus,
    )
    .await;

    match result {
        Ok(_) => Ok(Json(serde_json::json!({
            "success": true,
            "message": "Backup restored successfully"
        }))),
        Err(e) => {
            error!("Backup restoration failed: {}", e);
            Err(ApiError::internal(e.to_string()))
        }
    }
}

/// Delete a backup
pub async fn delete_backup(
    State(state): State<AppState>,
    Extension(server): Extension<Arc<Server>>,
    Path((_server_id, backup_id)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let server_uuid = server.uuid();
    let backup_dir = state.config.system.backup_directory.join(&server_uuid);

    info!("Deleting backup {} for server {}", backup_id, server_uuid);

    match server::delete_backup(&backup_dir, &backup_id) {
        Ok(_) => Ok(Json(serde_json::json!({
            "success": true
        }))),
        Err(e) => {
            error!("Backup deletion failed: {}", e);
            Err(ApiError::internal(e.to_string()))
        }
    }
}

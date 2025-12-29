//! Server transfer handlers

use std::sync::Arc;

use axum::{
    body::Bytes,
    extract::State,
    http::HeaderMap,
    Extension, Json,
};
use serde::{Deserialize, Serialize};
use tracing::{error, info};

use crate::server::{
    Server, create_transfer_archive, receive_transfer_archive,
    cleanup_transfer_archive, TransferError,
};
use super::super::AppState;
use super::ApiError;

/// Transfer initiation request
#[derive(Debug, Deserialize)]
pub struct InitiateTransferRequest {
    /// Transfer ID from the API
    pub transfer_id: String,
    /// Target node URL
    pub target_url: String,
    /// Target node authentication token
    pub target_token: String,
}

/// Transfer initiation response
#[derive(Debug, Serialize)]
pub struct TransferResponse {
    pub success: bool,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub checksum: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<u64>,
}

impl From<TransferError> for ApiError {
    fn from(err: TransferError) -> Self {
        match &err {
            TransferError::ServerRunning => ApiError::conflict(err.to_string()),
            TransferError::AlreadyTransferring => ApiError::conflict(err.to_string()),
            TransferError::ChecksumMismatch => ApiError::bad_request(err.to_string()),
            _ => ApiError::internal(err.to_string()),
        }
    }
}

/// Initiate a server transfer (source node endpoint)
///
/// This endpoint creates a transfer archive of the server's data
/// and optionally uploads it to the target node.
pub async fn initiate_transfer(
    State(state): State<AppState>,
    Extension(server): Extension<Arc<Server>>,
    Json(request): Json<InitiateTransferRequest>,
) -> Result<Json<TransferResponse>, ApiError> {
    let server_uuid = server.uuid();
    let transfer_id = request.transfer_id.clone();

    info!("Initiating transfer {} for server {}", transfer_id, server_uuid);

    // Check if server is already transferring
    if server.is_transferring() {
        return Err(ApiError::conflict("Server is already transferring"));
    }

    // Check if server is stopped
    if server.process_state() != crate::events::ProcessState::Offline {
        return Err(ApiError::conflict("Server must be stopped before transferring"));
    }

    // Try to acquire transfer lock
    if !server.server_state().try_start_transferring() {
        return Err(ApiError::conflict("Could not acquire transfer lock"));
    }

    // Create the transfer archive
    let data_dir = server.data_dir();
    let archive_dir = state.config.system.tmp_directory.join("transfers");
    let event_bus = server.events();

    let result = create_transfer_archive(
        &server_uuid,
        &transfer_id,
        data_dir,
        &archive_dir,
        &[], // No ignore patterns for transfer
        event_bus,
    ).await;

    match result {
        Ok(archive_result) => {
            info!(
                "Transfer archive created: {} bytes, checksum: {}",
                archive_result.size, archive_result.checksum
            );

            // If target URL provided, upload the archive
            if !request.target_url.is_empty() {
                let upload_result = crate::server::upload_transfer_archive(
                    &archive_result.path,
                    &request.target_url,
                    &request.target_token,
                    &server_uuid,
                    &transfer_id,
                    &archive_result.checksum,
                    event_bus,
                ).await;

                // Clean up local archive after upload attempt
                let _ = cleanup_transfer_archive(&archive_dir, &transfer_id);

                // Release transfer lock
                server.server_state().set_transferring(false);

                match upload_result {
                    Ok(_) => Ok(Json(TransferResponse {
                        success: true,
                        message: "Transfer archive uploaded successfully".to_string(),
                        checksum: Some(archive_result.checksum),
                        size: Some(archive_result.size),
                    })),
                    Err(e) => {
                        error!("Failed to upload transfer archive: {}", e);
                        Err(e.into())
                    }
                }
            } else {
                // No upload, just return archive info
                server.server_state().set_transferring(false);

                Ok(Json(TransferResponse {
                    success: true,
                    message: "Transfer archive created".to_string(),
                    checksum: Some(archive_result.checksum),
                    size: Some(archive_result.size),
                }))
            }
        }
        Err(e) => {
            error!("Failed to create transfer archive: {}", e);
            server.server_state().set_transferring(false);
            Err(e.into())
        }
    }
}

/// Receive a server transfer (target node endpoint)
///
/// This endpoint receives a transfer archive from another node
/// and extracts it to the server's data directory.
pub async fn receive_transfer(
    State(state): State<AppState>,
    Extension(server): Extension<Arc<Server>>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<TransferResponse>, ApiError> {
    let server_uuid = server.uuid();

    // Get transfer metadata from headers
    let transfer_id = headers
        .get("X-Transfer-Id")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unknown")
        .to_string();

    let expected_checksum = headers
        .get("X-Transfer-Checksum")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    info!(
        "Receiving transfer {} for server {} ({} bytes)",
        transfer_id, server_uuid, body.len()
    );

    // Check if server is already transferring
    if server.is_transferring() {
        return Err(ApiError::conflict("Server is already transferring"));
    }

    // Check if server is stopped
    if server.process_state() != crate::events::ProcessState::Offline {
        return Err(ApiError::conflict("Server must be stopped to receive transfer"));
    }

    // Try to acquire transfer lock
    if !server.server_state().try_start_transferring() {
        return Err(ApiError::conflict("Could not acquire transfer lock"));
    }

    // Receive and extract the transfer archive
    let data_dir = server.data_dir();
    let archive_dir = state.config.system.tmp_directory.join("transfers");
    let event_bus = server.events();

    let result = receive_transfer_archive(
        &server_uuid,
        &transfer_id,
        body.to_vec(),
        &expected_checksum,
        data_dir,
        &archive_dir,
        true, // Truncate existing data
        event_bus,
    ).await;

    // Release transfer lock
    server.server_state().set_transferring(false);

    match result {
        Ok(_) => {
            info!("Transfer {} received successfully", transfer_id);
            Ok(Json(TransferResponse {
                success: true,
                message: "Transfer received and extracted successfully".to_string(),
                checksum: None,
                size: None,
            }))
        }
        Err(e) => {
            error!("Failed to receive transfer: {}", e);
            Err(e.into())
        }
    }
}

/// Get transfer status
#[derive(Debug, Serialize)]
pub struct TransferStatusResponse {
    pub is_transferring: bool,
}

pub async fn transfer_status(
    Extension(server): Extension<Arc<Server>>,
) -> Json<TransferStatusResponse> {
    Json(TransferStatusResponse {
        is_transferring: server.is_transferring(),
    })
}

/// Cancel an in-progress transfer
pub async fn cancel_transfer(
    Extension(server): Extension<Arc<Server>>,
) -> Result<Json<TransferResponse>, ApiError> {
    if !server.is_transferring() {
        return Err(ApiError::bad_request("No transfer in progress"));
    }

    // Release the transfer lock
    server.server_state().set_transferring(false);

    Ok(Json(TransferResponse {
        success: true,
        message: "Transfer cancelled".to_string(),
        checksum: None,
        size: None,
    }))
}

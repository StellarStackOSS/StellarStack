//! Schedule handlers for server task scheduling

use std::sync::Arc;

use axum::{
    extract::{Json, State},
    Extension,
    http::StatusCode,
};
use serde::{Deserialize, Serialize};
use tracing::{debug, info, warn};
use uuid::Uuid;

use crate::server::{PowerAction, Server, BackupCompressionLevel, self};
use crate::events::{Event, ProcessState};
use super::super::AppState;

/// Schedule data from API
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct Schedule {
    pub id: String,
    pub name: String,
    #[serde(rename = "cronExpression")]
    pub cron_expression: String,
    #[serde(default)]
    pub enabled: bool,
    pub tasks: Vec<ScheduleTask>,
}

/// Task within a schedule
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ScheduleTask {
    pub id: String,
    pub action: String,
    pub payload: Option<String>,
    #[serde(rename = "timeOffset")]
    pub time_offset: i32,
    pub sequence: i32,
    #[serde(rename = "triggerMode", default = "default_trigger_mode")]
    pub trigger_mode: String,
}

fn default_trigger_mode() -> String {
    "TIME_DELAY".to_string()
}

/// Sync schedules from API
pub async fn sync_schedules(
    State(_state): State<AppState>,
    Extension(server): Extension<Arc<Server>>,
    Json(schedules): Json<Vec<Schedule>>,
) -> Result<StatusCode, StatusCode> {
    info!("Syncing {} schedules for server {}", schedules.len(), server.uuid());

    // TODO: Store schedules in server and register with cron scheduler
    // For now, just log and accept
    for schedule in schedules {
        debug!("Schedule: {} - {} ({})", schedule.id, schedule.name, schedule.cron_expression);
    }

    Ok(StatusCode::NO_CONTENT)
}

/// Create a new schedule
pub async fn create_schedule(
    State(_state): State<AppState>,
    Extension(server): Extension<Arc<Server>>,
    Json(schedule): Json<Schedule>,
) -> Result<StatusCode, StatusCode> {
    info!("Creating schedule {} for server {}", schedule.name, server.uuid());

    // Validate cron expression
    if let Err(e) = croner::Cron::new(&schedule.cron_expression).parse() {
        warn!("Invalid cron expression '{}': {}", schedule.cron_expression, e);
        return Err(StatusCode::BAD_REQUEST);
    }

    // TODO: Store schedule and register with cron
    debug!("Schedule {} created successfully", schedule.id);

    Ok(StatusCode::CREATED)
}

/// Update a schedule
pub async fn update_schedule(
    State(_state): State<AppState>,
    Extension(server): Extension<Arc<Server>>,
    Json(schedule): Json<Schedule>,
) -> Result<StatusCode, StatusCode> {
    info!("Updating schedule {} for server {}", schedule.name, server.uuid());

    // Validate cron expression
    if let Err(e) = croner::Cron::new(&schedule.cron_expression).parse() {
        warn!("Invalid cron expression '{}': {}", schedule.cron_expression, e);
        return Err(StatusCode::BAD_REQUEST);
    }

    // TODO: Update schedule in server
    debug!("Schedule {} updated successfully", schedule.id);

    Ok(StatusCode::NO_CONTENT)
}

/// Delete a schedule
pub async fn delete_schedule(
    State(_state): State<AppState>,
    Extension(server): Extension<Arc<Server>>,
    Json(schedule_id): Json<String>,
) -> Result<StatusCode, StatusCode> {
    info!("Deleting schedule {} for server {}", schedule_id, server.uuid());

    // TODO: Remove schedule from server
    debug!("Schedule {} deleted successfully", schedule_id);

    Ok(StatusCode::NO_CONTENT)
}

/// Execute a schedule immediately (manual trigger)
pub async fn execute_schedule(
    State(state): State<AppState>,
    Extension(server): Extension<Arc<Server>>,
    Json(schedule): Json<Schedule>,
) -> Result<StatusCode, StatusCode> {
    info!("Manually executing schedule {} for server {}", schedule.name, server.uuid());

    // Execute tasks sequentially based on their trigger mode
    for (index, task) in schedule.tasks.iter().enumerate() {
        info!(
            "Executing task {} ({}): {} (trigger: {})",
            index, task.id, task.action, task.trigger_mode
        );

        // Emit event about which task is executing
        server.events().publish(Event::ScheduleExecuting {
            schedule_id: schedule.id.clone(),
            task_index: Some(index),
        });

        // Update schedule status tracker (for websocket sync)
        server.schedule_status().set_executing(&schedule.id, index);

        // Notify API about schedule execution status
        notify_api_schedule_executing(&state, &server.uuid(), &schedule.id, Some(index)).await;

        match task.trigger_mode.as_str() {
            "TIME_DELAY" => {
                // Wait for time offset before executing
                if task.time_offset > 0 {
                    debug!(
                        "Waiting {} seconds before executing task {}",
                        task.time_offset, task.action
                    );
                    tokio::time::sleep(tokio::time::Duration::from_secs(task.time_offset as u64))
                        .await;
                }

                // Execute the task
                if let Err(e) = execute_task(&state, &server, task).await {
                    // Commands failing don't stop the schedule, but other tasks do
                    if task.action == "command" {
                        warn!("Command task failed (will continue): {}", e);
                    } else {
                        warn!("Critical task {} failed: {}", task.action, e);
                        return Err(StatusCode::INTERNAL_SERVER_ERROR);
                    }
                }
            }
            "ON_COMPLETION" => {
                // Execute task and wait for completion event
                if let Err(e) = execute_task_and_wait_completion(&state, &server, task).await {
                    // Commands failing don't stop the schedule, but other tasks do
                    if task.action == "command" {
                        warn!("Command task failed (will continue): {}", e);
                    } else {
                        warn!("Critical task {} failed or timed out: {}", task.action, e);
                        return Err(StatusCode::INTERNAL_SERVER_ERROR);
                    }
                }
            }
            _ => {
                warn!("Unknown trigger mode: {}", task.trigger_mode);
                return Err(StatusCode::BAD_REQUEST);
            }
        }
    }

    info!("Schedule {} completed successfully", schedule.name);

    // Emit event that schedule is no longer executing
    server.events().publish(Event::ScheduleExecuting {
        schedule_id: schedule.id.clone(),
        task_index: None,
    });

    // Update schedule status tracker (for websocket sync)
    server.schedule_status().set_finished(&schedule.id, true);

    // Notify API that schedule execution is complete
    notify_api_schedule_executing(&state, &server.uuid(), &schedule.id, None).await;

    Ok(StatusCode::NO_CONTENT)
}

/// Execute a single task
async fn execute_task(
    state: &AppState,
    server: &Server,
    task: &ScheduleTask,
) -> Result<(), String> {
    info!("Executing task: {} for server {}", task.action, server.uuid());

    match task.action.as_str() {
        "power_start" => {
            server.handle_power_action(PowerAction::Start, false)
                .await
                .map_err(|e| e.to_string())?;
        }
        "power_stop" => {
            server.handle_power_action(PowerAction::Stop, false)
                .await
                .map_err(|e| e.to_string())?;
        }
        "power_restart" => {
            server.handle_power_action(PowerAction::Restart, false)
                .await
                .map_err(|e| e.to_string())?;
        }
        "backup" => {
            let backup_uuid = Uuid::new_v4().to_string();
            let server_uuid = server.uuid();
            let data_dir = server.data_dir();
            let backup_dir = state.config.system.backup_directory.join(&server_uuid);
            let event_bus = server.events();
            let rate_limit = state.config.system.backup_rate_limit_mibps;

            info!(
                "Creating backup {} for server {} via schedule (rate_limit: {:?} MiB/s)",
                backup_uuid, server_uuid, rate_limit
            );

            server::create_backup_with_config(
                &server_uuid,
                &backup_uuid,
                data_dir,
                &backup_dir,
                &[],
                event_bus,
                BackupCompressionLevel::default(),
                rate_limit,
            )
            .await
            .map_err(|e| format!("Backup creation failed: {}", e))?;
        }
        "command" => {
            if let Some(payload) = &task.payload {
                server.send_command(payload)
                    .await
                    .map_err(|e| e.to_string())?;
            }
        }
        _ => {
            warn!("Unknown task action: {}", task.action);
            return Err(format!("Unknown action: {}", task.action));
        }
    }

    Ok(())
}

/// Execute a task and wait for its completion event
async fn execute_task_and_wait_completion(
    state: &AppState,
    server: &Server,
    task: &ScheduleTask,
) -> Result<(), String> {
    debug!(
        "Executing task with completion wait: {} for server {}",
        task.action,
        server.uuid()
    );

    // Subscribe to server events before executing task
    let mut event_rx = server.events().subscribe();

    // Execute the task
    execute_task(state, server, task).await?;

    // Wait for completion event with timeout (10 minutes max)
    let completion_timeout = tokio::time::Duration::from_secs(600);

    match task.action.as_str() {
        "backup" => {
            // Wait for BackupCompleted event
            match tokio::time::timeout(completion_timeout, async {
                loop {
                    match event_rx.recv().await {
                        Ok(event) => {
                            if let Event::BackupCompleted {
                                successful,
                                uuid,
                                checksum,
                                size,
                                ..
                            } = event
                            {
                                debug!("Backup {} completed: {}", uuid, successful);
                                // Notify API about backup completion
                                let backup_request = crate::api::BackupRequest {
                                    successful,
                                    checksum: checksum.clone(),
                                    checksum_type: if checksum.is_some() { Some("sha256".to_string()) } else { None },
                                    size,
                                    parts: None,
                                };

                                if let Err(e) = state.api_client.set_backup_status(&uuid, &backup_request).await {
                                    warn!("Failed to notify API about backup {}: {}", uuid, e);
                                } else {
                                    info!("Notified API about completed backup {}", uuid);
                                }

                                return Ok(successful);
                            }
                        }
                        Err(_) => {
                            return Err("Event bus closed".to_string());
                        }
                    }
                }
            })
            .await
            {
                Ok(Ok(true)) => {
                    info!("Backup completed successfully");
                    Ok(())
                }
                Ok(Ok(false)) => Err("Backup failed".to_string()),
                Err(_) => Err("Backup timed out after 10 minutes".to_string()),
                Ok(Err(e)) => Err(e),
            }
        }
        "power_start" | "power_stop" | "power_restart" => {
            // Determine target state
            let target_state = match task.action.as_str() {
                "power_start" => ProcessState::Running,
                "power_stop" => ProcessState::Offline,
                "power_restart" => ProcessState::Running,
                _ => ProcessState::Offline,
            };

            // Wait for StateChange event to desired state
            match tokio::time::timeout(completion_timeout, async {
                loop {
                    match event_rx.recv().await {
                        Ok(event) => {
                            if let Event::StateChange(state) = event {
                                debug!("Server state changed to: {:?}", state);
                                if state == target_state {
                                    return Ok(());
                                }
                            }
                        }
                        Err(_) => {
                            return Err("Event bus closed".to_string());
                        }
                    }
                }
            })
            .await
            {
                Ok(Ok(())) => {
                    info!(
                        "Power action completed: server reached {:?}",
                        target_state
                    );
                    Ok(())
                }
                Err(_) => Err(format!(
                    "Power action timed out waiting for {:?}",
                    target_state
                )),
                Ok(Err(e)) => Err(e),
            }
        }
        "command" => {
            // Commands complete immediately (no async completion event)
            debug!("Command executed (immediate completion)");
            Ok(())
        }
        _ => Err(format!("Unknown action type for completion wait: {}", task.action)),
    }
}

/// Notify API about schedule execution status
async fn notify_api_schedule_executing(
    state: &AppState,
    server_uuid: &str,
    schedule_id: &str,
    task_index: Option<usize>,
) {
    match state.api_client.notify_schedule_executing(server_uuid, schedule_id, task_index).await {
        Ok(_) => {
            debug!(
                "Notified API about schedule {} task {}",
                schedule_id,
                task_index
                    .map(|i| i.to_string())
                    .unwrap_or_else(|| "completion".to_string())
            );
        }
        Err(e) => {
            warn!("Failed to notify API about schedule execution: {}", e);
        }
    }
}

//! Schedule handlers for server task scheduling

use std::sync::Arc;

use axum::{
    extract::{Json, State},
    Extension,
    http::StatusCode,
};
use tracing::{debug, info, warn};
use uuid::Uuid;

use crate::server::{PowerAction, Server, BackupCompressionLevel, Schedule, ScheduleTask, self};
use crate::events::{Event, ProcessState};
use super::super::AppState;

/// Sync schedules from API
pub async fn sync_schedules(
    State(_state): State<AppState>,
    Extension(server): Extension<Arc<Server>>,
    Json(schedules): Json<Vec<Schedule>>,
) -> Result<StatusCode, StatusCode> {
    info!("Syncing {} schedules for server {}", schedules.len(), server.uuid());

    // Cancel existing cron jobs first
    let existing_ids: Vec<String> = server.get_all_schedules().iter().map(|s| s.id.clone()).collect();
    for schedule_id in existing_ids {
        server.unregister_cron_job(&schedule_id);
    }

    // Store and register each schedule
    for schedule in schedules {
        // Validate cron expression
        if let Err(e) = croner::Cron::new(&schedule.cron_expression).parse() {
            warn!("Invalid cron expression '{}' in schedule {}: {}", schedule.cron_expression, schedule.id, e);
            continue;
        }

        let schedule_id = schedule.id.clone();
        let enabled = schedule.enabled;

        debug!("Synced schedule: {} - {} ({})", schedule_id, schedule.name, schedule.cron_expression);
        server.store_schedule(schedule);

        // Register cron job if enabled
        if enabled {
            crate::server::Server::register_cron_job_with_server(server.clone(), schedule_id);
        }
    }

    info!("Successfully synced {} schedules for server {}", server.get_all_schedules().len(), server.uuid());
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

    // Store the schedule in the server
    let schedule_id = schedule.id.clone();
    let enabled = schedule.enabled;
    server.store_schedule(schedule);

    // Register cron job if enabled
    if enabled {
        crate::server::Server::register_cron_job_with_server(server.clone(), schedule_id.clone());
        info!("Registered cron job for schedule {}", schedule_id);
    }

    info!("Schedule {} created successfully for server {}", schedule_id, server.uuid());
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

    // Check if schedule exists
    if server.get_schedule(&schedule.id).is_none() {
        warn!("Schedule {} not found for server {}", schedule.id, server.uuid());
        return Err(StatusCode::NOT_FOUND);
    }

    let schedule_id = schedule.id.clone();
    let enabled = schedule.enabled;

    // First, unregister the existing cron job
    server.unregister_cron_job(&schedule_id);

    // Update the schedule in the server (replace existing)
    server.store_schedule(schedule);

    // Re-register cron job if enabled
    if enabled {
        crate::server::Server::register_cron_job_with_server(server.clone(), schedule_id.clone());
        info!("Re-registered cron job for schedule {}", schedule_id);
    }

    info!("Schedule {} updated successfully for server {}", schedule_id, server.uuid());
    Ok(StatusCode::NO_CONTENT)
}

/// Delete a schedule
pub async fn delete_schedule(
    State(_state): State<AppState>,
    Extension(server): Extension<Arc<Server>>,
    Json(schedule_id): Json<String>,
) -> Result<StatusCode, StatusCode> {
    info!("Deleting schedule {} for server {}", schedule_id, server.uuid());

    // Unregister the cron job
    server.unregister_cron_job(&schedule_id);

    // Try to remove the schedule from the server
    match server.remove_schedule(&schedule_id) {
        Some(_) => {
            info!("Schedule {} deleted successfully for server {}", schedule_id, server.uuid());
            Ok(StatusCode::NO_CONTENT)
        }
        None => {
            warn!("Schedule {} not found for server {}", schedule_id, server.uuid());
            Err(StatusCode::NOT_FOUND)
        }
    }
}

/// Execute a schedule immediately (manual trigger)
pub async fn execute_schedule(
    State(state): State<AppState>,
    Extension(server): Extension<Arc<Server>>,
    Json(schedule): Json<Schedule>,
) -> Result<StatusCode, StatusCode> {
    info!("Manually executing schedule {} for server {}", schedule.name, server.uuid());

    // Execute the schedule's tasks
    match execute_schedule_tasks(&state, &server, &schedule).await {
        Ok(_) => {
            info!("Schedule {} completed successfully", schedule.name);
            Ok(StatusCode::NO_CONTENT)
        }
        Err(e) => {
            warn!("Schedule {} execution failed: {}", schedule.name, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Execute all tasks in a schedule (used by both manual execution and cron jobs)
pub async fn execute_schedule_tasks(
    state: &AppState,
    server: &Server,
    schedule: &Schedule,
) -> Result<(), String> {
    // Emit event that schedule is starting
    server.events().publish(Event::ScheduleExecuting {
        schedule_id: schedule.id.clone(),
        task_index: None,
    });

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
        notify_api_schedule_executing(state, &server.uuid(), &schedule.id, Some(index)).await;

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
                if let Err(e) = execute_task(state, server, task).await {
                    // Commands failing don't stop the schedule, but other tasks do
                    if task.action == "command" {
                        warn!("Command task failed (will continue): {}", e);
                    } else {
                        warn!("Critical task {} failed: {}", task.action, e);
                        return Err(format!("Task {} failed: {}", task.id, e));
                    }
                }
            }
            "ON_COMPLETION" => {
                // Execute task and wait for completion event
                if let Err(e) = execute_task_and_wait_completion(state, server, task).await {
                    // Commands failing don't stop the schedule, but other tasks do
                    if task.action == "command" {
                        warn!("Command task failed (will continue): {}", e);
                    } else {
                        warn!("Critical task {} failed or timed out: {}", task.action, e);
                        return Err(format!("Task {} failed: {}", task.id, e));
                    }
                }
            }
            _ => {
                warn!("Unknown trigger mode: {}", task.trigger_mode);
                return Err(format!("Unknown trigger mode: {}", task.trigger_mode));
            }
        }
    }

    // Emit event that schedule is no longer executing
    server.events().publish(Event::ScheduleExecuting {
        schedule_id: schedule.id.clone(),
        task_index: None,
    });

    // Update schedule status tracker (for websocket sync)
    server.schedule_status().set_finished(&schedule.id, true);

    // Notify API that schedule execution is complete
    notify_api_schedule_executing(state, &server.uuid(), &schedule.id, None).await;

    Ok(())
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

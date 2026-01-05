//! Schedule handlers for server task scheduling

use std::sync::Arc;

use axum::{
    extract::{Json, State},
    Extension,
    http::StatusCode,
};
use serde::{Deserialize, Serialize};
use tracing::{debug, info, warn};

use crate::server::{PowerAction, Server};
use super::super::AppState;

/// Schedule data from API
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct Schedule {
    pub id: String,
    pub name: String,
    #[serde(rename = "cronExpression")]
    pub cron_expression: String,
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

    // Execute tasks in sequence
    for task in schedule.tasks {
        if let Err(e) = execute_task(&state, &server, &task).await {
            warn!("Failed to execute task {}: {}", task.action, e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }

        // Wait for time offset if specified
        if task.time_offset > 0 {
            tokio::time::sleep(tokio::time::Duration::from_secs(task.time_offset as u64)).await;
        }
    }

    Ok(StatusCode::NO_CONTENT)
}

/// Execute a single task
async fn execute_task(
    _state: &AppState,
    server: &Server,
    task: &ScheduleTask,
) -> Result<(), String> {
    debug!("Executing task: {} for server {}", task.action, server.uuid());

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
            // TODO: Trigger backup creation
            info!("Backup task triggered for server {}", server.uuid());
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

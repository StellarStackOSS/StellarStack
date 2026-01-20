//! Schedule status tracking
//!
//! Tracks the current execution status of schedules for a server,
//! allowing clients to sync state when connecting via websocket.

use std::collections::HashMap;
use std::sync::Arc;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

/// Status of a schedule execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduleStatus {
    /// Schedule ID
    pub id: String,
    /// Schedule name
    pub name: String,
    /// Whether the schedule is currently executing
    pub is_executing: bool,
    /// Currently executing task index (if executing)
    pub executing_task_index: Option<usize>,
    /// Last execution time (unix timestamp)
    pub last_execution_time: Option<u64>,
    /// Next expected execution time (unix timestamp) - estimated from cron
    pub next_execution_time: Option<u64>,
    /// Whether the schedule is enabled
    pub enabled: bool,
    /// Last execution result (success/failure)
    pub last_result: Option<String>,
}

/// Schedule status tracker for a server
///
/// Maintains the current status of all schedules to allow clients to sync
/// state when they connect or refresh.
pub struct ScheduleStatusTracker {
    /// Map of schedule_id -> ScheduleStatus
    statuses: Arc<RwLock<HashMap<String, ScheduleStatus>>>,
}

impl ScheduleStatusTracker {
    /// Create a new schedule status tracker
    pub fn new() -> Self {
        Self {
            statuses: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Update or create a schedule status
    pub fn update_status(&self, schedule_id: String, status: ScheduleStatus) {
        let mut statuses = self.statuses.write();
        statuses.insert(schedule_id, status);
    }

    /// Set a schedule as executing
    pub fn set_executing(&self, schedule_id: &str, task_index: usize) {
        let mut statuses = self.statuses.write();
        if let Some(status) = statuses.get_mut(schedule_id) {
            status.is_executing = true;
            status.executing_task_index = Some(task_index);
            status.last_execution_time = Some(current_timestamp());
        }
    }

    /// Set a schedule as finished executing
    pub fn set_finished(&self, schedule_id: &str, successful: bool) {
        let mut statuses = self.statuses.write();
        if let Some(status) = statuses.get_mut(schedule_id) {
            status.is_executing = false;
            status.executing_task_index = None;
            status.last_result = Some(if successful { "success" } else { "failed" }.to_string());
        }
    }

    /// Get the status of a specific schedule
    pub fn get_status(&self, schedule_id: &str) -> Option<ScheduleStatus> {
        let statuses = self.statuses.read();
        statuses.get(schedule_id).cloned()
    }

    /// Get all schedule statuses for this server
    pub fn get_all_statuses(&self) -> Vec<ScheduleStatus> {
        let statuses = self.statuses.read();
        statuses.values().cloned().collect()
    }

    /// Clear all statuses (e.g., when server stops)
    pub fn clear(&self) {
        self.statuses.write().clear();
    }
}

impl Default for ScheduleStatusTracker {
    fn default() -> Self {
        Self::new()
    }
}

impl Clone for ScheduleStatusTracker {
    fn clone(&self) -> Self {
        Self {
            statuses: Arc::clone(&self.statuses),
        }
    }
}

/// Get current unix timestamp
fn current_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

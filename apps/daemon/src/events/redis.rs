//! Redis pub/sub integration for event broadcasting
//!
//! Publishes server events to Redis channels for external consumers
//! like the API server to receive real-time updates.

use std::sync::Arc;

use parking_lot::RwLock;
use redis::aio::ConnectionManager;
use serde::Serialize;
use tracing::{debug, error, info, warn};

use super::{Event, Stats};

/// Message published to Redis
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", content = "data")]
#[serde(rename_all = "snake_case")]
pub enum RedisMessage {
    /// Server state changed
    StateChange {
        server_id: String,
        state: String,
    },

    /// Resource statistics update
    Stats {
        server_id: String,
        #[serde(flatten)]
        stats: Stats,
    },

    /// Console output from the server
    ConsoleOutput {
        server_id: String,
        output: String,
    },

    /// Installation process started
    InstallStarted {
        server_id: String,
    },

    /// Installation process completed
    InstallCompleted {
        server_id: String,
        successful: bool,
    },

    /// Installation output line
    InstallOutput {
        server_id: String,
        output: String,
    },

    /// Backup process started
    BackupStarted {
        server_id: String,
        backup_id: String,
    },

    /// Backup process completed
    BackupCompleted {
        server_id: String,
        backup_id: String,
        successful: bool,
        checksum: Option<String>,
        size: u64,
    },

    /// Schedule task execution status
    ScheduleExecuting {
        server_id: String,
        schedule_id: String,
        task_index: Option<usize>,
    },
}

/// Redis publisher for broadcasting events
pub struct RedisPublisher {
    /// Redis connection manager
    connection: Arc<RwLock<Option<ConnectionManager>>>,

    /// Channel prefix
    prefix: String,

    /// Server ID for this publisher
    server_id: String,

    /// Whether Redis is enabled
    enabled: bool,
}

impl RedisPublisher {
    /// Create a new Redis publisher (not yet connected)
    pub fn new(server_id: String, prefix: String, enabled: bool) -> Self {
        Self {
            connection: Arc::new(RwLock::new(None)),
            prefix,
            server_id,
            enabled,
        }
    }

    /// Connect to Redis
    pub async fn connect(&self, url: &str) -> Result<(), redis::RedisError> {
        if !self.enabled {
            debug!("Redis publishing disabled, skipping connection");
            return Ok(());
        }

        info!("Connecting to Redis at {}", url);

        let client = redis::Client::open(url)?;
        let connection = ConnectionManager::new(client).await?;

        *self.connection.write() = Some(connection);

        info!("Connected to Redis successfully");
        Ok(())
    }

    /// Publish an event to Redis
    pub async fn publish(&self, event: &Event) {
        if !self.enabled {
            return;
        }

        let connection = {
            let guard = self.connection.read();
            guard.clone()
        };

        let Some(mut conn) = connection else {
            return;
        };

        // Convert event to Redis message
        let message = match self.event_to_message(event) {
            Some(msg) => msg,
            None => return, // Some events don't need to be published
        };

        // Serialize to JSON
        let json = match serde_json::to_string(&message) {
            Ok(j) => j,
            Err(e) => {
                error!("Failed to serialize Redis message: {}", e);
                return;
            }
        };

        // Determine channel based on message type
        let channel = self.get_channel(&message);

        // Publish to Redis
        let result: Result<(), redis::RedisError> = redis::cmd("PUBLISH")
            .arg(&channel)
            .arg(&json)
            .query_async(&mut conn)
            .await;

        match result {
            Ok(_) => {
                debug!("Published to Redis channel {}: {}", channel, json);
            }
            Err(e) => {
                warn!("Failed to publish to Redis: {}", e);
            }
        }
    }

    /// Convert an Event to a Redis message
    fn event_to_message(&self, event: &Event) -> Option<RedisMessage> {
        match event {
            Event::StateChange(state) => Some(RedisMessage::StateChange {
                server_id: self.server_id.clone(),
                state: state.to_string(),
            }),

            Event::Stats(stats) => Some(RedisMessage::Stats {
                server_id: self.server_id.clone(),
                stats: stats.clone(),
            }),

            Event::ConsoleOutput(data) => {
                let output = String::from_utf8_lossy(data).to_string();
                Some(RedisMessage::ConsoleOutput {
                    server_id: self.server_id.clone(),
                    output,
                })
            }

            Event::InstallStarted => Some(RedisMessage::InstallStarted {
                server_id: self.server_id.clone(),
            }),

            Event::InstallCompleted { successful } => Some(RedisMessage::InstallCompleted {
                server_id: self.server_id.clone(),
                successful: *successful,
            }),

            Event::InstallOutput(data) => {
                let output = String::from_utf8_lossy(data).to_string();
                Some(RedisMessage::InstallOutput {
                    server_id: self.server_id.clone(),
                    output,
                })
            }

            Event::BackupStarted { uuid } => Some(RedisMessage::BackupStarted {
                server_id: self.server_id.clone(),
                backup_id: uuid.clone(),
            }),

            Event::BackupCompleted { uuid, successful, checksum, size } => {
                Some(RedisMessage::BackupCompleted {
                    server_id: self.server_id.clone(),
                    backup_id: uuid.clone(),
                    successful: *successful,
                    checksum: checksum.clone(),
                    size: *size,
                })
            }

            Event::ScheduleExecuting { schedule_id, task_index } => {
                Some(RedisMessage::ScheduleExecuting {
                    server_id: self.server_id.clone(),
                    schedule_id: schedule_id.clone(),
                    task_index: *task_index,
                })
            }

            // Other events don't need Redis publishing
            Event::BackupRestoreStarted { .. } |
            Event::BackupRestoreCompleted { .. } |
            Event::TransferStarted |
            Event::TransferProgress { .. } |
            Event::TransferCompleted { .. } |
            Event::ServerSynced |
            Event::ConfigurationUpdated => None,
        }
    }

    /// Get the Redis channel for a message
    fn get_channel(&self, message: &RedisMessage) -> String {
        match message {
            RedisMessage::StateChange { server_id, .. } => {
                format!("{}:server:{}:state", self.prefix, server_id)
            }
            RedisMessage::Stats { server_id, .. } => {
                format!("{}:server:{}:stats", self.prefix, server_id)
            }
            RedisMessage::ConsoleOutput { server_id, .. } => {
                format!("{}:server:{}:console", self.prefix, server_id)
            }
            RedisMessage::InstallStarted { server_id } |
            RedisMessage::InstallCompleted { server_id, .. } |
            RedisMessage::InstallOutput { server_id, .. } => {
                format!("{}:server:{}:install", self.prefix, server_id)
            }
            RedisMessage::BackupStarted { server_id, .. } |
            RedisMessage::BackupCompleted { server_id, .. } => {
                format!("{}:server:{}:backup", self.prefix, server_id)
            }
            RedisMessage::ScheduleExecuting { server_id, .. } => {
                format!("{}:server:{}:schedule", self.prefix, server_id)
            }
        }
    }

    /// Check if connected
    pub fn is_connected(&self) -> bool {
        self.connection.read().is_some()
    }
}

impl Clone for RedisPublisher {
    fn clone(&self) -> Self {
        Self {
            connection: self.connection.clone(),
            prefix: self.prefix.clone(),
            server_id: self.server_id.clone(),
            enabled: self.enabled,
        }
    }
}

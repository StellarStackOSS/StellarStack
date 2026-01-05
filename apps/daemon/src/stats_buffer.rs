use crate::events::Stats;
use redis::{Commands, RedisResult};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, RwLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const BUFFER_DURATION: Duration = Duration::from_secs(180); // 3 minutes
const MAX_BUFFER_SIZE: usize = 180; // ~1 stat per second for 3 minutes
const REDIS_TTL: i64 = 180; // 3 minutes in seconds

#[derive(Clone, Serialize, Deserialize)]
pub struct StatsEntry {
    pub stats: Stats,
    pub timestamp: u64, // Unix timestamp in milliseconds
}

enum StorageBackend {
    Redis(redis::Client),
    Memory(Arc<RwLock<HashMap<String, VecDeque<StatsEntry>>>>),
}

/// Thread-safe stats buffer that maintains recent stats for all servers
/// Uses Redis if available, otherwise falls back to in-memory storage
#[derive(Clone)]
pub struct StatsBuffer {
    backend: Arc<StorageBackend>,
}

impl StatsBuffer {
    /// Create a new stats buffer with Redis backend if available
    pub fn new(redis_url: Option<&str>) -> Self {
        let backend = if let Some(url) = redis_url {
            match redis::Client::open(url) {
                Ok(client) => {
                    // Test connection
                    if client.get_connection().is_ok() {
                        tracing::info!("Stats buffer using Redis backend");
                        StorageBackend::Redis(client)
                    } else {
                        tracing::warn!("Redis connection failed, using in-memory stats buffer");
                        StorageBackend::Memory(Arc::new(RwLock::new(HashMap::new())))
                    }
                }
                Err(e) => {
                    tracing::warn!("Failed to create Redis client: {}, using in-memory stats buffer", e);
                    StorageBackend::Memory(Arc::new(RwLock::new(HashMap::new())))
                }
            }
        } else {
            tracing::info!("No Redis configured, using in-memory stats buffer");
            StorageBackend::Memory(Arc::new(RwLock::new(HashMap::new())))
        };

        Self {
            backend: Arc::new(backend),
        }
    }

    /// Add a stats entry for a server
    pub fn push(&self, server_uuid: &str, stats: Stats) {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        let entry = StatsEntry { stats, timestamp };

        match &*self.backend {
            StorageBackend::Redis(client) => {
                if let Ok(mut conn) = client.get_connection() {
                    let key = format!("stats:{}", server_uuid);
                    let value = serde_json::to_string(&entry).unwrap();

                    // Add to sorted set with timestamp as score
                    let _: RedisResult<()> = conn.zadd(&key, &value, timestamp as f64);

                    // Set expiry
                    let _: RedisResult<()> = conn.expire(&key, REDIS_TTL);

                    // Remove old entries (older than 3 minutes)
                    let cutoff = timestamp - (BUFFER_DURATION.as_millis() as u64);
                    let _: RedisResult<()> = conn.zrembyscore(&key, 0.0, cutoff as f64);
                }
            }
            StorageBackend::Memory(buffers) => {
                let mut buffers = buffers.write().unwrap();
                let buffer = buffers.entry(server_uuid.to_string()).or_insert_with(VecDeque::new);

                buffer.push_back(entry);

                // Trim old entries
                let cutoff = timestamp - (BUFFER_DURATION.as_millis() as u64);
                while let Some(front) = buffer.front() {
                    if front.timestamp < cutoff {
                        buffer.pop_front();
                    } else {
                        break;
                    }
                }

                // Also enforce max size
                while buffer.len() > MAX_BUFFER_SIZE {
                    buffer.pop_front();
                }
            }
        }
    }

    /// Get all buffered stats for a server (last 3 minutes)
    pub fn get_history(&self, server_uuid: &str) -> Vec<StatsEntry> {
        match &*self.backend {
            StorageBackend::Redis(client) => {
                if let Ok(mut conn) = client.get_connection() {
                    let key = format!("stats:{}", server_uuid);
                    let cutoff = SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .unwrap()
                        .as_millis() as u64
                        - (BUFFER_DURATION.as_millis() as u64);

                    // Get all entries newer than cutoff
                    let result: RedisResult<Vec<String>> = conn.zrangebyscore(&key, cutoff as f64, "+inf");

                    if let Ok(entries) = result {
                        return entries
                            .into_iter()
                            .filter_map(|s| serde_json::from_str(&s).ok())
                            .collect();
                    }
                }
                Vec::new()
            }
            StorageBackend::Memory(buffers) => {
                let buffers = buffers.read().unwrap();
                buffers
                    .get(server_uuid)
                    .map(|buffer| buffer.iter().cloned().collect())
                    .unwrap_or_default()
            }
        }
    }

    /// Get the most recent stats for a server
    pub fn get_latest(&self, server_uuid: &str) -> Option<StatsEntry> {
        match &*self.backend {
            StorageBackend::Redis(client) => {
                if let Ok(mut conn) = client.get_connection() {
                    let key = format!("stats:{}", server_uuid);
                    // Get the highest scoring (most recent) entry
                    let result: RedisResult<Vec<String>> = conn.zrevrange(&key, 0, 0);

                    if let Ok(entries) = result {
                        return entries.first().and_then(|s| serde_json::from_str(s).ok());
                    }
                }
                None
            }
            StorageBackend::Memory(buffers) => {
                let buffers = buffers.read().unwrap();
                buffers
                    .get(server_uuid)
                    .and_then(|buffer| buffer.back().cloned())
            }
        }
    }

    /// Clear buffer for a server
    pub fn clear(&self, server_uuid: &str) {
        match &*self.backend {
            StorageBackend::Redis(client) => {
                if let Ok(mut conn) = client.get_connection() {
                    let key = format!("stats:{}", server_uuid);
                    let _: RedisResult<()> = conn.del(&key);
                }
            }
            StorageBackend::Memory(buffers) => {
                let mut buffers = buffers.write().unwrap();
                buffers.remove(server_uuid);
            }
        }
    }
}

impl Default for StatsBuffer {
    fn default() -> Self {
        Self::new(None)
    }
}

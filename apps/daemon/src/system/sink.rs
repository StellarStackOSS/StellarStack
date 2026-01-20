//! Sink pool for broadcasting log output
//!
//! Provides a pub/sub mechanism for streaming console output and logs
//! to multiple subscribers (e.g., WebSocket connections).
//!
//! Implements a ring-buffer strategy (like Pterodactyl Wings) where:
//! - Slow subscribers don't block the pipeline
//! - Old messages are dropped if subscribers lag
//! - Multiple subscribers are handled efficiently with atomic operations

use std::collections::VecDeque;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use parking_lot::RwLock;
use tokio::sync::broadcast;
use chrono::Utc;
use tracing::debug;

/// Default number of log lines to buffer
const DEFAULT_BUFFER_SIZE: usize = 500;

/// Default broadcast channel capacity (messages to buffer before dropping slow subscribers)
const DEFAULT_CHANNEL_CAPACITY: usize = 1024;

/// A buffered log entry with timestamp
#[derive(Clone, Debug)]
pub struct LogEntry {
    pub data: Vec<u8>,
    pub timestamp: i64, // milliseconds since epoch
}

/// A pool of sinks for broadcasting data to multiple subscribers.
///
/// This is used to stream console output to multiple WebSocket connections.
/// Includes a ring buffer to keep recent messages for new subscribers.
///
/// Implements a non-blocking strategy (like Pterodactyl Wings):
/// - Slow subscribers don't block the pipeline
/// - Old messages are dropped if subscribers lag too far
/// - Multiple concurrent subscribers are supported efficiently
///
/// Note: Cloning a SinkPool shares the same underlying broadcast channel AND buffer,
/// so all clones see the same history and can push to the same buffer.
pub struct SinkPool {
    sender: broadcast::Sender<Vec<u8>>,
    // Keep a receiver to prevent the channel from closing
    _receiver: broadcast::Receiver<Vec<u8>>,
    // Ring buffer for recent messages with timestamps (shared across clones via Arc)
    buffer: Arc<RwLock<VecDeque<LogEntry>>>,
    // Maximum buffer size
    buffer_size: usize,
    // Counter for dropped messages (when subscribers lag too far)
    dropped_messages: Arc<AtomicU64>,
}

impl SinkPool {
    /// Create a new sink pool with the specified capacity
    pub fn new() -> Self {
        Self::with_capacity(DEFAULT_CHANNEL_CAPACITY)
    }

    /// Create a new sink pool with custom capacity
    pub fn with_capacity(capacity: usize) -> Self {
        let (sender, _receiver) = broadcast::channel(capacity);
        Self {
            sender,
            _receiver,
            buffer: Arc::new(RwLock::new(VecDeque::with_capacity(DEFAULT_BUFFER_SIZE))),
            buffer_size: DEFAULT_BUFFER_SIZE,
            dropped_messages: Arc::new(AtomicU64::new(0)),
        }
    }

    /// Create a new sink pool with custom buffer size for history
    pub fn with_buffer_size(channel_capacity: usize, buffer_size: usize) -> Self {
        let (sender, _receiver) = broadcast::channel(channel_capacity);
        Self {
            sender,
            _receiver,
            buffer: Arc::new(RwLock::new(VecDeque::with_capacity(buffer_size))),
            buffer_size,
            dropped_messages: Arc::new(AtomicU64::new(0)),
        }
    }

    /// Subscribe to the sink pool
    ///
    /// Returns a receiver that will receive all messages sent after subscribing.
    pub fn subscribe(&self) -> broadcast::Receiver<Vec<u8>> {
        self.sender.subscribe()
    }

    /// Get buffered history of recent messages with timestamps
    ///
    /// Returns a copy of the ring buffer contents (oldest to newest)
    pub fn get_history(&self) -> Vec<LogEntry> {
        self.buffer.read().iter().cloned().collect()
    }

    /// Get buffered history as strings (for console output)
    pub fn get_history_strings(&self) -> Vec<String> {
        self.buffer
            .read()
            .iter()
            .map(|entry| String::from_utf8_lossy(&entry.data).to_string())
            .collect()
    }

    /// Get buffered history with timestamps as JSON objects
    pub fn get_history_with_timestamps(&self) -> Vec<(String, i64)> {
        self.buffer
            .read()
            .iter()
            .map(|entry| (String::from_utf8_lossy(&entry.data).to_string(), entry.timestamp))
            .collect()
    }

    /// Clear the buffer (e.g., when server stops or restarts)
    pub fn clear_buffer(&self) {
        self.buffer.write().clear();
    }

    /// Push data to all subscribers and buffer with current timestamp
    ///
    /// If there are no subscribers, the data is still buffered.
    /// Non-blocking: slow subscribers don't block this operation.
    pub fn push(&self, data: Vec<u8>) {
        self.push_with_timestamp(data, Utc::now().timestamp_millis());
    }

    /// Push data to all subscribers and buffer with specified timestamp
    ///
    /// Non-blocking: if subscribers lag too far, old messages are dropped rather
    /// than blocking the pipeline. This prevents slow clients from starving others.
    pub fn push_with_timestamp(&self, data: Vec<u8>, timestamp: i64) {
        // Add to ring buffer
        {
            let mut buffer = self.buffer.write();
            if buffer.len() >= self.buffer_size {
                buffer.pop_front();
            }
            buffer.push_back(LogEntry {
                data: data.clone(),
                timestamp,
            });
        }

        // Broadcast to subscribers (non-blocking)
        // If a subscriber lags too far, broadcast channel will drop them
        // Track dropped messages for monitoring
        match self.sender.send(data) {
            Ok(_) => {} // Normal send
            Err(broadcast::error::SendError(_)) => {
                // Channel is full - subscribers are lagging
                // This is expected behavior; we drop the message and track it
                self.dropped_messages.fetch_add(1, Ordering::SeqCst);
                debug!("SinkPool message dropped due to slow subscribers");
            }
        }
    }

    /// Push a string to all subscribers
    pub fn push_string(&self, data: &str) {
        self.push(data.as_bytes().to_vec());
    }

    /// Push a string to all subscribers with specified timestamp
    pub fn push_string_with_timestamp(&self, data: &str, timestamp: i64) {
        self.push_with_timestamp(data.as_bytes().to_vec(), timestamp);
    }

    /// Get the number of active subscribers
    pub fn subscriber_count(&self) -> usize {
        self.sender.receiver_count()
    }

    /// Get current buffer length
    pub fn buffer_len(&self) -> usize {
        self.buffer.read().len()
    }

    /// Get number of messages dropped due to slow subscribers
    pub fn dropped_message_count(&self) -> u64 {
        self.dropped_messages.load(Ordering::SeqCst)
    }

    /// Reset the dropped message counter (for diagnostics)
    pub fn reset_dropped_count(&self) {
        self.dropped_messages.store(0, Ordering::SeqCst);
    }
}

impl Default for SinkPool {
    fn default() -> Self {
        Self::new()
    }
}

impl Clone for SinkPool {
    fn clone(&self) -> Self {
        // Clone shares the same broadcast channel, buffer, and metrics (via Arc)
        // This is intentional - all clones should see the same history and be able to push to it
        Self {
            sender: self.sender.clone(),
            _receiver: self.sender.subscribe(),
            buffer: Arc::clone(&self.buffer),
            buffer_size: self.buffer_size,
            dropped_messages: Arc::clone(&self.dropped_messages),
        }
    }
}

/// A named sink pool that can store multiple named sinks
#[allow(dead_code)]
pub struct SinkPoolMap {
    pools: RwLock<std::collections::HashMap<String, SinkPool>>,
}

#[allow(dead_code)]
impl SinkPoolMap {
    pub fn new() -> Self {
        Self {
            pools: RwLock::new(std::collections::HashMap::new()),
        }
    }

    /// Get or create a sink pool for the given name
    pub fn get_or_create(&self, name: &str) -> SinkPool {
        {
            let pools = self.pools.read();
            if let Some(pool) = pools.get(name) {
                return pool.clone();
            }
        }

        let mut pools = self.pools.write();
        pools
            .entry(name.to_string())
            .or_insert_with(SinkPool::new)
            .clone()
    }

    /// Remove a sink pool
    pub fn remove(&self, name: &str) {
        self.pools.write().remove(name);
    }
}

impl Default for SinkPoolMap {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_sink_pool() {
        let pool = SinkPool::new();

        // Subscribe
        let mut rx = pool.subscribe();

        // Push data
        pool.push(b"Hello".to_vec());
        pool.push_string(" World");

        // Receive
        let msg1 = rx.recv().await.unwrap();
        assert_eq!(msg1, b"Hello");

        let msg2 = rx.recv().await.unwrap();
        assert_eq!(msg2, b" World");
    }

    #[tokio::test]
    async fn test_multiple_subscribers() {
        let pool = SinkPool::new();

        let mut rx1 = pool.subscribe();
        let mut rx2 = pool.subscribe();

        pool.push_string("test");

        assert_eq!(rx1.recv().await.unwrap(), b"test");
        assert_eq!(rx2.recv().await.unwrap(), b"test");
    }
}

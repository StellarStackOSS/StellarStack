//! Buffer pool for archive operations
//!
//! Provides reusable buffer pools to reduce allocations during backup and archive operations.
//! Based on Pterodactyl Wings sync.Pool pattern.

use std::sync::Arc;
use parking_lot::Mutex;

/// Thread-safe buffer pool for reusable buffers
///
/// Maintains a pool of pre-allocated buffers to reduce GC pressure during
/// intensive archive and compression operations.
///
/// **Performance Notes:**
/// - Reduces allocations during backup operations
/// - Each buffer is 64KB (tuned for tar operations)
/// - Can hold up to 100 buffers in the pool
/// - Unused buffers are automatically cleaned up
pub struct BufferPool {
    buffers: Arc<Mutex<Vec<Vec<u8>>>>,
    buffer_size: usize,
    max_buffers: usize,
}

impl BufferPool {
    /// Create a new buffer pool
    pub fn new() -> Self {
        Self::with_config(65536, 100) // 64KB buffers, max 100
    }

    /// Create a buffer pool with custom configuration
    pub fn with_config(buffer_size: usize, max_buffers: usize) -> Self {
        Self {
            buffers: Arc::new(Mutex::new(Vec::with_capacity(max_buffers))),
            buffer_size,
            max_buffers,
        }
    }

    /// Get a buffer from the pool, or create a new one if pool is empty
    pub fn get(&self) -> Vec<u8> {
        let mut buffers = self.buffers.lock();
        buffers.pop().unwrap_or_else(|| Vec::with_capacity(self.buffer_size))
    }

    /// Return a buffer to the pool for reuse
    ///
    /// The buffer must be cleared before reuse, but we don't do it here to avoid
    /// unnecessary memory operations.
    pub fn put(&self, mut buffer: Vec<u8>) {
        buffer.clear();
        buffer.shrink_to(self.buffer_size);

        let mut buffers = self.buffers.lock();
        if buffers.len() < self.max_buffers {
            buffers.push(buffer);
        }
        // If pool is full, just let the buffer be dropped (automatic cleanup)
    }

    /// Get the current number of buffers in the pool
    pub fn size(&self) -> usize {
        self.buffers.lock().len()
    }

    /// Clear all buffers from the pool
    pub fn clear(&self) {
        self.buffers.lock().clear();
    }
}

impl Default for BufferPool {
    fn default() -> Self {
        Self::new()
    }
}

impl Clone for BufferPool {
    fn clone(&self) -> Self {
        Self {
            buffers: Arc::clone(&self.buffers),
            buffer_size: self.buffer_size,
            max_buffers: self.max_buffers,
        }
    }
}

/// RAII guard for buffer pool buffers
///
/// Automatically returns the buffer to the pool when dropped
pub struct PooledBuffer {
    buffer: Vec<u8>,
    pool: BufferPool,
}

impl PooledBuffer {
    /// Create a new pooled buffer
    pub fn new(pool: BufferPool) -> Self {
        let buffer = pool.get();
        Self { buffer, pool }
    }

    /// Get a reference to the buffer
    pub fn as_slice(&self) -> &[u8] {
        &self.buffer
    }

    /// Get a mutable reference to the buffer
    pub fn as_mut_slice(&mut self) -> &mut [u8] {
        &mut self.buffer
    }

    /// Get the current length
    pub fn len(&self) -> usize {
        self.buffer.len()
    }

    /// Check if buffer is empty
    pub fn is_empty(&self) -> bool {
        self.buffer.is_empty()
    }

    /// Clear the buffer
    pub fn clear(&mut self) {
        self.buffer.clear();
    }
}

impl Drop for PooledBuffer {
    fn drop(&mut self) {
        // Clear and return buffer to pool
        self.buffer.clear();
        self.pool.put(std::mem::take(&mut self.buffer));
    }
}

impl std::ops::Deref for PooledBuffer {
    type Target = Vec<u8>;

    fn deref(&self) -> &Self::Target {
        &self.buffer
    }
}

impl std::ops::DerefMut for PooledBuffer {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.buffer
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_buffer_pool() {
        let pool = BufferPool::new();

        // Get a buffer
        let buf1 = pool.get();
        assert_eq!(pool.size(), 0);

        // Return it
        pool.put(buf1);
        assert_eq!(pool.size(), 1);

        // Get it again
        let _buf2 = pool.get();
        assert_eq!(pool.size(), 0);
    }

    #[test]
    fn test_buffer_pool_max_size() {
        let pool = BufferPool::with_config(1024, 2);

        let buf1 = pool.get();
        let buf2 = pool.get();
        let buf3 = pool.get();

        pool.put(buf1);
        assert_eq!(pool.size(), 1);

        pool.put(buf2);
        assert_eq!(pool.size(), 2);

        pool.put(buf3); // Should be dropped, pool is full
        assert_eq!(pool.size(), 2);
    }
}

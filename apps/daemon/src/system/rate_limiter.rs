//! Token bucket rate limiter for console output
//!
//! Implements a token bucket algorithm to rate limit console output per server,
//! preventing I/O saturation and ensuring other container operations remain responsive.
//!
//! Based on Pterodactyl Wings ConsoleThrottle pattern.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

/// Token bucket rate limiter for rate-limiting console output
///
/// Allows bursting up to `max_tokens` but maintains an average rate of `tokens_per_duration`.
/// This prevents a single server's console output from saturating disk I/O.
#[derive(Clone)]
pub struct TokenBucket {
    // Current number of available tokens
    tokens: Arc<AtomicU64>,
    // Timestamp of last refill (milliseconds since epoch)
    last_refill: Arc<AtomicU64>,
    // Maximum tokens (burst capacity)
    max_tokens: u64,
    // Tokens to add per refill interval
    tokens_per_interval: u64,
    // Refill interval in milliseconds
    refill_interval_ms: u64,
}

impl TokenBucket {
    /// Create a new token bucket with the given configuration
    ///
    /// # Arguments
    /// * `capacity` - Maximum burst capacity (tokens)
    /// * `rate_per_second` - Tokens to add per second
    pub fn new(capacity: u64, rate_per_second: u64) -> Self {
        let now = current_time_ms();
        Self {
            tokens: Arc::new(AtomicU64::new(capacity)),
            last_refill: Arc::new(AtomicU64::new(now)),
            max_tokens: capacity,
            tokens_per_interval: rate_per_second,
            refill_interval_ms: 1000, // 1 second
        }
    }

    /// Try to acquire `n` tokens. Returns true if successful, false if rate-limited.
    pub fn try_acquire(&self, tokens_needed: u64) -> bool {
        self.refill();

        let current = self.tokens.load(Ordering::SeqCst);
        if current >= tokens_needed {
            // Successfully acquire tokens
            self.tokens
                .fetch_sub(tokens_needed, Ordering::SeqCst);
            true
        } else {
            // Rate limited
            false
        }
    }

    /// Refill tokens based on elapsed time
    fn refill(&self) {
        let now = current_time_ms();
        let last = self.last_refill.load(Ordering::SeqCst);

        // Check if it's time to refill
        if now.saturating_sub(last) >= self.refill_interval_ms {
            // Calculate tokens to add
            let intervals_passed = (now - last) / self.refill_interval_ms;
            let tokens_to_add = intervals_passed * self.tokens_per_interval;

            // Update last refill time
            self.last_refill.store(now, Ordering::SeqCst);

            // Add tokens (capped at max)
            let current = self.tokens.load(Ordering::SeqCst);
            let new_tokens = std::cmp::min(current + tokens_to_add, self.max_tokens);
            self.tokens.store(new_tokens, Ordering::SeqCst);
        }
    }

    /// Get current number of available tokens
    pub fn available_tokens(&self) -> u64 {
        self.refill();
        self.tokens.load(Ordering::SeqCst)
    }
}

/// Console output rate limiter per server
///
/// Limits the rate of console output lines sent to websocket clients
/// to prevent I/O saturation while allowing bursting for normal operation.
pub struct ConsoleThrottle {
    bucket: TokenBucket,
}

impl ConsoleThrottle {
    /// Create a new console throttle
    ///
    /// Default: 60 lines per second with burst capacity of 120 lines
    pub fn new() -> Self {
        // 60 lines/sec with burst to 120
        Self {
            bucket: TokenBucket::new(120, 60),
        }
    }

    /// Create with custom configuration
    pub fn with_config(burst_capacity: u64, lines_per_second: u64) -> Self {
        Self {
            bucket: TokenBucket::new(burst_capacity, lines_per_second),
        }
    }

    /// Check if we can send a line (1 token = 1 line)
    /// Returns true if allowed, false if rate-limited
    pub fn allow_line(&self) -> bool {
        self.bucket.try_acquire(1)
    }

    /// Check if we can send multiple lines
    pub fn allow_lines(&self, count: u64) -> bool {
        self.bucket.try_acquire(count)
    }

    /// Get available capacity
    pub fn available_tokens(&self) -> u64 {
        self.bucket.available_tokens()
    }
}

impl Default for ConsoleThrottle {
    fn default() -> Self {
        Self::new()
    }
}

/// Get current time in milliseconds since epoch
fn current_time_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_token_bucket_basic() {
        let bucket = TokenBucket::new(10, 10); // 10 tokens/sec, max 10
        assert!(bucket.try_acquire(5));
        assert!(bucket.try_acquire(5));
        assert!(!bucket.try_acquire(1)); // Should be rate-limited now
    }

    #[test]
    fn test_console_throttle() {
        let throttle = ConsoleThrottle::new();

        // Should allow up to burst capacity
        for _ in 0..120 {
            assert!(throttle.allow_line());
        }

        // Should be rate-limited after burst
        assert!(!throttle.allow_line());
    }
}

//! System resource monitoring with periodic debug logging
//!
//! Tracks CPU, RAM, disk, and I/O metrics for debugging performance issues.
//! Can be enabled/disabled via configuration or logging level.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::SystemTime;
use tracing::{debug, warn};

#[cfg(unix)]
use std::fs;
#[cfg(unix)]
use std::path::Path;

/// System resource monitoring
pub struct SystemMonitor {
    enabled: Arc<AtomicBool>,
    last_stats: parking_lot::Mutex<Option<SystemStats>>,
}

/// Current system statistics
#[derive(Debug, Clone, Copy)]
struct SystemStats {
    timestamp: SystemTime,
    /// CPU usage percentage (0-100 * num_cpus)
    cpu_usage: f64,
    /// Available memory in MB
    available_memory: u64,
    /// Total memory in MB
    total_memory: u64,
    /// Available disk space in MB
    available_disk: u64,
    /// Total disk space in MB
    total_disk: u64,
    /// Cumulative disk I/O reads in bytes
    disk_read_bytes: u64,
    /// Cumulative disk I/O writes in bytes
    disk_write_bytes: u64,
}

impl SystemMonitor {
    /// Create a new system monitor
    pub fn new() -> Self {
        Self {
            enabled: Arc::new(AtomicBool::new(false)),
            last_stats: parking_lot::Mutex::new(None),
        }
    }

    /// Enable system monitoring
    pub fn enable(&self) {
        self.enabled.store(true, Ordering::Relaxed);
        debug!("System monitoring enabled");
    }

    /// Disable system monitoring
    pub fn disable(&self) {
        self.enabled.store(false, Ordering::Relaxed);
        debug!("System monitoring disabled");
    }

    /// Check if monitoring is enabled
    pub fn is_enabled(&self) -> bool {
        self.enabled.load(Ordering::Relaxed)
    }

    /// Log current system resources if enabled
    pub fn log_resources(&self) {
        if !self.is_enabled() {
            return;
        }

        match self.collect_stats() {
            Ok(current) => {
                // Log current metrics
                debug!(
                    "System Resources - Memory: {}/{} MB ({:.1}%), CPU: {:.1}%, Disk: {}/{} MB ({:.1}%)",
                    current.total_memory - current.available_memory,
                    current.total_memory,
                    ((current.total_memory - current.available_memory) as f64
                        / current.total_memory as f64)
                        * 100.0,
                    current.cpu_usage,
                    (current.total_disk - current.available_disk) / 1024,
                    current.total_disk / 1024,
                    ((current.total_disk - current.available_disk) as f64
                        / current.total_disk as f64)
                        * 100.0
                );

                // If we have previous stats, calculate I/O rate
                if let Some(previous) = *self.last_stats.lock() {
                    if let Ok(elapsed) = current.timestamp.duration_since(previous.timestamp) {
                        if elapsed.as_secs() > 0 {
                            let read_rate =
                                (current.disk_read_bytes - previous.disk_read_bytes) / elapsed.as_secs();
                            let write_rate =
                                (current.disk_write_bytes - previous.disk_write_bytes) / elapsed.as_secs();

                            debug!(
                                "Disk I/O - Read: {}/s, Write: {}/s",
                                format_bytes(read_rate),
                                format_bytes(write_rate)
                            );
                        }
                    }
                }

                *self.last_stats.lock() = Some(current);
            }
            Err(e) => {
                warn!("Failed to collect system stats: {}", e);
            }
        }
    }

    /// Collect current system statistics
    fn collect_stats(&self) -> Result<SystemStats, String> {
        let timestamp = SystemTime::now();

        // Get system info
        let mut sys = sysinfo::System::new_all();
        sys.refresh_all();

        let total_memory = sys.total_memory();
        let available_memory = sys.available_memory();

        let cpu_usage = calculate_cpu_usage(&sys)?;
        let (available_disk, total_disk) = get_disk_usage()?;
        let (read_bytes, write_bytes) = get_disk_io()?;

        Ok(SystemStats {
            timestamp,
            cpu_usage,
            available_memory: available_memory / 1024, // Convert to MB
            total_memory: total_memory / 1024,         // Convert to MB
            available_disk,
            total_disk,
            disk_read_bytes: read_bytes,
            disk_write_bytes: write_bytes,
        })
    }
}

impl Default for SystemMonitor {
    fn default() -> Self {
        Self::new()
    }
}

impl Clone for SystemMonitor {
    fn clone(&self) -> Self {
        Self {
            enabled: Arc::clone(&self.enabled),
            last_stats: parking_lot::Mutex::new(*self.last_stats.lock()),
        }
    }
}

/// Calculate CPU usage percentage
fn calculate_cpu_usage(sys: &sysinfo::System) -> Result<f64, String> {
    let mut total_usage = 0.0f64;
    let mut cpu_count = 0;

    for cpu in sys.cpus() {
        total_usage += cpu.cpu_usage() as f64;
        cpu_count += 1;
    }

    if cpu_count > 0 {
        Ok((total_usage / cpu_count as f64).min(100.0))
    } else {
        Ok(0.0)
    }
}

/// Get disk usage in MB
#[cfg(unix)]
fn get_disk_usage() -> Result<(u64, u64), String> {
    use nix::sys::statvfs::statvfs;

    let stat = statvfs(Path::new("/"))
        .map_err(|e| format!("Failed to get disk usage: {}", e))?;

    let block_size = stat.block_size() as u64;
    let available_blocks = stat.blocks_available() as u64;
    let total_blocks = stat.blocks() as u64;

    Ok((
        available_blocks * block_size / 1024 / 1024, // Available in MB
        total_blocks * block_size / 1024 / 1024,     // Total in MB
    ))
}

#[cfg(not(unix))]
fn get_disk_usage() -> Result<(u64, u64), String> {
    // Fallback for Windows - use fixed values or simple approach
    Ok((1024 * 1024, 2048 * 1024))
}

/// Get disk I/O statistics in bytes (cumulative)
#[cfg(unix)]
fn get_disk_io() -> Result<(u64, u64), String> {
    // Read /proc/diskstats on Linux
    let diskstats = fs::read_to_string("/proc/diskstats")
        .map_err(|e| format!("Failed to read /proc/diskstats: {}", e))?;

    let mut total_read = 0u64;
    let mut total_write = 0u64;

    for line in diskstats.lines() {
        let fields: Vec<&str> = line.split_whitespace().collect();
        if fields.len() < 14 {
            continue;
        }

        // Skip loop devices and ram disks
        if fields[2].starts_with("loop") || fields[2].starts_with("ram") {
            continue;
        }

        // Fields: major minor name reads_completed reads_merged reads_sectors reads_time
        //         writes_completed writes_merged writes_sectors writes_time ...
        if let (Ok(read_sectors), Ok(write_sectors)) = (fields[5].parse::<u64>(), fields[9].parse::<u64>()) {
            total_read += read_sectors * 512;  // Convert sectors to bytes
            total_write += write_sectors * 512;
        }
    }

    Ok((total_read, total_write))
}

#[cfg(not(unix))]
fn get_disk_io() -> Result<(u64, u64), String> {
    // Not readily available on Windows
    Ok((0, 0))
}

/// Format bytes as human-readable string
fn format_bytes(bytes: u64) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB"];
    let mut size = bytes as f64;
    let mut unit_idx = 0;

    while size >= 1024.0 && unit_idx < UNITS.len() - 1 {
        size /= 1024.0;
        unit_idx += 1;
    }

    format!("{:.2}{}", size, UNITS[unit_idx])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_bytes() {
        assert_eq!(format_bytes(512), "512.00B");
        assert_eq!(format_bytes(1024), "1.00KB");
        assert_eq!(format_bytes(1024 * 1024), "1.00MB");
        assert_eq!(format_bytes(1024 * 1024 * 1024), "1.00GB");
    }

    #[test]
    fn test_system_monitor_enable_disable() {
        let monitor = SystemMonitor::new();
        assert!(!monitor.is_enabled());

        monitor.enable();
        assert!(monitor.is_enabled());

        monitor.disable();
        assert!(!monitor.is_enabled());
    }

    #[test]
    fn test_system_monitor_clone() {
        let monitor = SystemMonitor::new();
        monitor.enable();

        let cloned = monitor.clone();
        assert_eq!(monitor.is_enabled(), cloned.is_enabled());
    }
}

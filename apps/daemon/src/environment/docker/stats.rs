//! Resource statistics collection

use bollard::container::StatsOptions;
use futures_util::StreamExt;
use tokio_util::sync::CancellationToken;
use tracing::{debug, warn};

use crate::events::{Event, NetworkStats, Stats};
use crate::filesystem::disk::calculate_dir_size_sync;
use super::environment::DockerEnvironment;
use super::super::traits::{EnvironmentResult, ProcessEnvironment};

/// Poll container resource statistics continuously
#[allow(dead_code)]
pub async fn poll_stats(
    env: &DockerEnvironment,
    ctx: CancellationToken,
) -> EnvironmentResult<()> {
    let container_name = env.container_name();
    let event_bus = env.events().clone();

    let options = StatsOptions {
        stream: true,
        one_shot: false,
    };

    let mut stream = env.docker().stats(container_name, Some(options));

    let mut prev_cpu: Option<u64> = None;
    let mut prev_system: Option<u64> = None;

    while let Some(result) = stream.next().await {
        if ctx.is_cancelled() {
            debug!("Stats polling cancelled for {}", container_name);
            break;
        }

        match result {
            Ok(docker_stats) => {
                // Calculate memory usage (excluding caches like Wings does)
                let memory = calculate_memory(&docker_stats.memory_stats);
                let memory_limit = docker_stats
                    .memory_stats
                    .limit
                    .unwrap_or(0);

                // Calculate CPU percentage
                let cpu = calculate_cpu(
                    &docker_stats.cpu_stats,
                    &prev_cpu,
                    &prev_system,
                );

                // Update previous values for next calculation
                prev_cpu = Some(docker_stats.cpu_stats.cpu_usage.total_usage);
                prev_system = docker_stats.cpu_stats.system_cpu_usage;

                // Calculate network stats
                let network = calculate_network(&docker_stats.networks);

                // Get uptime (approximate from stats read time)
                let uptime = match env.uptime().await {
                    Ok(u) => u,
                    Err(_) => 0,
                };

                // Calculate disk usage from server data directory
                let (disk_bytes, disk_limit_bytes) = if let Some(mount) = env.config().mounts.first() {
                    let data_dir = std::path::Path::new(&mount.source);
                    let disk_limit = env.config().limits.disk_space;

                    // Calculate actual disk usage (synchronous to avoid blocking the stream)
                    let disk_usage = match calculate_dir_size_sync(data_dir) {
                        Ok(size) => {
                            debug!("Successfully calculated disk usage for {:?}: {} bytes", data_dir, size);
                            size
                        }
                        Err(e) => {
                            warn!("Failed to calculate disk usage for {:?}: {}, using 0", data_dir, e);
                            0
                        }
                    };
                    (disk_usage, disk_limit)
                } else {
                    (0, env.config().limits.disk_space)
                };

                let stats = Stats {
                    memory_bytes: memory,
                    memory_limit_bytes: memory_limit,
                    cpu_absolute: cpu,
                    network,
                    uptime,
                    disk_bytes,
                    disk_limit_bytes,
                };

                // Publish stats event
                event_bus.publish(Event::Stats(stats));
            }
            Err(e) => {
                // Container might have stopped - check various error conditions
                let error_str = e.to_string();

                let is_stopped = matches!(
                    &e,
                    bollard::errors::Error::DockerResponseServerError { status_code: 404, .. } |
                    bollard::errors::Error::DockerResponseServerError { status_code: 409, .. }
                ) || error_str.contains("container is stopped")
                  || error_str.contains("not running")
                  || error_str.contains("No such container");

                // JSON deserialization errors typically happen when Docker sends incomplete
                // stats as the container is exiting - treat these as normal stop conditions
                let is_json_error = matches!(&e, bollard::errors::Error::JsonDataError { .. })
                    || error_str.contains("missing field")
                    || error_str.contains("Failed to deserialize");

                if is_stopped || is_json_error {
                    debug!("Container {} stopped or sent incomplete stats, stopping stats poller", container_name);
                    break;
                }
                warn!("Error reading stats from {}: {}", container_name, e);
            }
        }
    }

    Ok(())
}

/// Calculate memory usage matching Docker stats output
///
/// Returns actual memory usage in bytes. The bollard library provides
/// raw usage which includes caching, matching Docker CLI behavior.
fn calculate_memory(stats: &bollard::container::MemoryStats) -> u64 {
    stats.usage.unwrap_or(0)
}

/// Calculate CPU percentage from Docker stats (Pterodactyl-style)
///
/// Matches Docker CLI output by:
/// 1. Calculating change in CPU usage between readings
/// 2. Calculating change in system CPU between readings
/// 3. Dividing container delta by system delta
/// 4. Multiplying by number of CPUs
/// 5. Rounding to 3 decimal places
///
/// See: https://github.com/docker/cli/blob/aa097cf1aa19099da70930460250797c8920b709/cli/command/container/stats_helpers.go#L166
fn calculate_cpu(
    stats: &bollard::container::CPUStats,
    prev_cpu: &Option<u64>,
    prev_system: &Option<u64>,
) -> f64 {
    let current_cpu = stats.cpu_usage.total_usage;
    let current_system = stats.system_cpu_usage.unwrap_or(0);

    if let (Some(prev_c), Some(prev_s)) = (prev_cpu, prev_system) {
        let cpu_delta = current_cpu.saturating_sub(*prev_c);
        let system_delta = current_system.saturating_sub(*prev_s);

        // Determine number of online CPUs (fallback to 1 if not available)
        let cpus = stats.online_cpus.map(|c| c as f64).unwrap_or_else(|| {
            // Fallback: count PercpuUsage length if online_cpus not available
            stats.cpu_usage.percpu_usage.as_ref()
                .map(|v| v.len() as f64)
                .unwrap_or(1.0)
        });

        if system_delta > 0 && cpu_delta > 0 {
            let percent = (cpu_delta as f64 / system_delta as f64) * 100.0 * cpus;
            // Round to 3 decimal places, matching Pterodactyl
            (percent * 1000.0).round() / 1000.0
        } else {
            0.0
        }
    } else {
        0.0
    }
}

/// Calculate network statistics from Docker stats
fn calculate_network(
    networks: &Option<std::collections::HashMap<String, bollard::container::NetworkStats>>,
) -> NetworkStats {
    let mut rx_bytes = 0u64;
    let mut tx_bytes = 0u64;

    if let Some(nets) = networks {
        for (_name, stats) in nets {
            rx_bytes += stats.rx_bytes;
            tx_bytes += stats.tx_bytes;
        }
    }

    NetworkStats { rx_bytes, tx_bytes }
}

/// Start continuous stats polling for a container
#[allow(dead_code)]
pub fn start_stats_poller(
    env: &DockerEnvironment,
    ctx: CancellationToken,
) -> tokio::task::JoinHandle<()> {
    let container_name = env.container_name().to_string();
    let docker = env.docker().clone();
    let event_bus = env.events().clone();
    let config = env.config().clone();

    tokio::spawn(async move {
        let options = StatsOptions {
            stream: true,
            one_shot: false,
        };

        let mut stream = docker.stats(&container_name, Some(options));

        let mut prev_cpu: Option<u64> = None;
        let mut prev_system: Option<u64> = None;

        loop {
            tokio::select! {
                Some(result) = stream.next() => {
                    match result {
                        Ok(docker_stats) => {
                            let memory = calculate_memory(&docker_stats.memory_stats);
                            let memory_limit = docker_stats.memory_stats.limit.unwrap_or(0);

                            let cpu = calculate_cpu(
                                &docker_stats.cpu_stats,
                                &prev_cpu,
                                &prev_system,
                            );

                            prev_cpu = Some(docker_stats.cpu_stats.cpu_usage.total_usage);
                            prev_system = docker_stats.cpu_stats.system_cpu_usage;

                            let network = calculate_network(&docker_stats.networks);

                            // Calculate disk usage from server data directory
                            let (disk_bytes, disk_limit_bytes) = if let Some(mount) = config.mounts.first() {
                                let data_dir = std::path::Path::new(&mount.source);
                                let disk_limit = config.limits.disk_space;

                                // Calculate actual disk usage (synchronous)
                                let disk_usage = calculate_dir_size_sync(data_dir).unwrap_or(0);
                                (disk_usage, disk_limit)
                            } else {
                                (0, config.limits.disk_space)
                            };

                            let stats = Stats {
                                memory_bytes: memory,
                                memory_limit_bytes: memory_limit,
                                cpu_absolute: cpu,
                                network,
                                uptime: 0, // Will be filled by server
                                disk_bytes,
                                disk_limit_bytes,
                            };

                            event_bus.publish(Event::Stats(stats));
                        }
                        Err(e) => {
                            // Container might have stopped - check various error conditions
                            let error_str = e.to_string();

                            let is_stopped = matches!(
                                &e,
                                bollard::errors::Error::DockerResponseServerError { status_code: 404, .. } |
                                bollard::errors::Error::DockerResponseServerError { status_code: 409, .. }
                            ) || error_str.contains("container is stopped")
                              || error_str.contains("not running")
                              || error_str.contains("No such container");

                            // JSON deserialization errors typically happen when Docker sends incomplete
                            // stats as the container is exiting - treat these as normal stop conditions
                            let is_json_error = matches!(&e, bollard::errors::Error::JsonDataError { .. })
                                || error_str.contains("missing field")
                                || error_str.contains("Failed to deserialize");

                            if is_stopped || is_json_error {
                                debug!("Container {} stopped or sent incomplete stats, stopping stats poller", container_name);
                                break;
                            }
                            warn!("Stats error for {}: {}", container_name, e);
                        }
                    }
                }
                _ = ctx.cancelled() => {
                    debug!("Stats poller cancelled for {}", container_name);
                    break;
                }
            }
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn test_calculate_memory() {
        let mut stats = bollard::container::MemoryStats::default();
        stats.usage = Some(100_000_000); // 100MB

        assert_eq!(calculate_memory(&stats), 100_000_000);
    }

    #[test]
    fn test_calculate_cpu() {
        let mut stats = bollard::container::CPUStats::default();
        stats.cpu_usage.total_usage = 200_000_000;
        stats.system_cpu_usage = Some(1_000_000_000);
        stats.online_cpus = Some(4);

        // First call (no previous values)
        let cpu = calculate_cpu(&stats, &None, &None);
        assert_eq!(cpu, 0.0);

        // Second call with previous values
        let prev_cpu = Some(100_000_000u64);
        let prev_system = Some(500_000_000u64);

        let cpu = calculate_cpu(&stats, &prev_cpu, &prev_system);

        // Expected: (100M / 500M) * 4 * 100 = 80%
        assert!((cpu - 80.0).abs() < 0.1);
    }

    #[test]
    fn test_calculate_network() {
        let mut networks = HashMap::new();

        let mut eth0 = bollard::container::NetworkStats::default();
        eth0.rx_bytes = 1000;
        eth0.tx_bytes = 2000;
        networks.insert("eth0".to_string(), eth0);

        let mut eth1 = bollard::container::NetworkStats::default();
        eth1.rx_bytes = 500;
        eth1.tx_bytes = 1000;
        networks.insert("eth1".to_string(), eth1);

        let result = calculate_network(&Some(networks));
        assert_eq!(result.rx_bytes, 1500);
        assert_eq!(result.tx_bytes, 3000);
    }
}

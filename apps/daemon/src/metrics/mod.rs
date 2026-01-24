//! Metrics collection and reporting module
//!
//! Collects system and container metrics and sends them to the panel API

use std::sync::Arc;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use tracing::{debug, error};

use crate::api::HttpClient;
use crate::config::Configuration;
use crate::server::Manager;

/// Node metrics snapshot to be sent to panel
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeMetricsSnapshot {
    pub cpu_usage: f32,
    pub memory_usage: u64,
    pub memory_limit: u64,
    pub disk_usage: u64,
    pub disk_limit: u64,
    pub active_containers: usize,
    pub total_containers: usize,
}

/// Server metrics snapshot to be sent to panel
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerMetricsSnapshot {
    pub server_id: String,
    pub cpu_usage: f32,
    pub memory_usage: u64,
    pub memory_limit: u64,
    pub disk_usage: u64,
    pub disk_limit: u64,
    pub uptime: u64,
    pub status: String,
}

/// Metrics collector for gathering system and container metrics
pub struct MetricsCollector {
    api_client: Arc<HttpClient>,
    config: Arc<Configuration>,
    manager: Arc<Manager>,
}

impl MetricsCollector {
    /// Create a new metrics collector
    pub fn new(
        api_client: Arc<HttpClient>,
        config: Arc<Configuration>,
        manager: Arc<Manager>,
    ) -> Self {
        Self {
            api_client,
            config,
            manager,
        }
    }

    /// Collect node-level metrics
    pub async fn collect_node_metrics(&self) -> Result<NodeMetricsSnapshot> {
        // Collect CPU usage (simplified - would use /proc/stat in production)
        let cpu_usage = self.get_cpu_usage().await;

        // Collect memory metrics
        let (memory_usage, memory_limit) = self.get_memory_metrics().await;

        // Collect disk metrics
        let (disk_usage, disk_limit) = self.get_disk_metrics().await;

        // Get container counts
        let active_containers = self.manager.count();
        let total_containers = self.manager.count();

        Ok(NodeMetricsSnapshot {
            cpu_usage,
            memory_usage,
            memory_limit,
            disk_usage,
            disk_limit,
            active_containers,
            total_containers,
        })
    }

    /// Collect all server metrics
    pub async fn collect_server_metrics(&self) -> Vec<ServerMetricsSnapshot> {
        let mut metrics = Vec::new();

        for server in self.manager.all() {
            if let Ok(snapshot) = self.collect_single_server_metrics(&server).await {
                metrics.push(snapshot);
            }
        }

        metrics
    }

    /// Collect metrics for a single server
    async fn collect_single_server_metrics(
        &self,
        server: &crate::server::Server,
    ) -> Result<ServerMetricsSnapshot> {
        let server_id = server.uuid().to_string();

        // Determine status from server state
        let status = if server.is_installing() {
            "installing".to_string()
        } else if server.is_transferring() {
            "transferring".to_string()
        } else if server.is_restoring() {
            "restoring".to_string()
        } else if server.is_suspended() {
            "suspended".to_string()
        } else {
            format!("{:?}", server.process_state()).to_lowercase()
        };

        // Get container stats if available
        let (cpu_usage, memory_usage, memory_limit, disk_usage, disk_limit, uptime) =
            self.get_container_stats(server).await;

        Ok(ServerMetricsSnapshot {
            server_id,
            cpu_usage,
            memory_usage,
            memory_limit,
            disk_usage,
            disk_limit,
            uptime,
            status,
        })
    }

    /// Send collected metrics to the panel API
    pub async fn send_metrics(&self, node_metrics: &NodeMetricsSnapshot) -> Result<()> {
        debug!("Sending node metrics to panel API");

        // Collect server metrics
        let server_metrics = self.collect_server_metrics().await;

        // Build payload
        let payload = serde_json::json!({
            "node": {
                "cpu_usage": node_metrics.cpu_usage,
                "memory_usage": node_metrics.memory_usage,
                "memory_limit": node_metrics.memory_limit,
                "disk_usage": node_metrics.disk_usage,
                "disk_limit": node_metrics.disk_limit,
                "active_containers": node_metrics.active_containers,
                "total_containers": node_metrics.total_containers,
            },
            "servers": server_metrics.iter().map(|s| {
                serde_json::json!({
                    "server_id": s.server_id,
                    "cpu_usage": s.cpu_usage,
                    "memory_usage": s.memory_usage,
                    "memory_limit": s.memory_limit,
                    "disk_usage": s.disk_usage,
                    "disk_limit": s.disk_limit,
                    "uptime": s.uptime,
                    "status": s.status,
                })
            }).collect::<Vec<_>>()
        });

        // Send to API using the metrics endpoint
        match self.api_client.send_metrics(payload).await {
            Ok(_) => {
                debug!("Node metrics sent successfully. CPU={:.1}%, Memory={}/{} MB",
                    node_metrics.cpu_usage,
                    node_metrics.memory_usage / 1024 / 1024,
                    node_metrics.memory_limit / 1024 / 1024
                );
                Ok(())
            }
            Err(e) => {
                error!("Failed to send metrics to API: {}", e);
                Err(e.into())
            }
        }
    }

    /// Get CPU usage percentage (simplified)
    async fn get_cpu_usage(&self) -> f32 {
        // In a real implementation, this would read /proc/stat and calculate CPU usage
        // For now, return a mock value
        0.0
    }

    /// Get memory metrics (usage, limit)
    async fn get_memory_metrics(&self) -> (u64, u64) {
        // In a real implementation, this would read /proc/meminfo or cgroup limits
        // For now, return mock values
        (0, 16 * 1024 * 1024 * 1024) // 16GB limit
    }

    /// Get disk metrics (usage, limit)
    async fn get_disk_metrics(&self) -> (u64, u64) {
        // In a real implementation, this would use statvfs or similar
        // For now, return mock values
        (0, 1024 * 1024 * 1024 * 1024) // 1TB limit
    }

    /// Get container statistics
    async fn get_container_stats(&self, _server: &crate::server::Server) -> (f32, u64, u64, u64, u64, u64) {
        // In a real implementation, this would query Docker stats
        // For now, return mock values
        (
            0.0,                               // CPU %
            512 * 1024 * 1024,                 // Memory usage (512 MB)
            1024 * 1024 * 1024,                // Memory limit (1 GB)
            100 * 1024 * 1024,                 // Disk usage (100 MB)
            50 * 1024 * 1024 * 1024,           // Disk limit (50 GB)
            3600,                              // Uptime (1 hour)
        )
    }
}

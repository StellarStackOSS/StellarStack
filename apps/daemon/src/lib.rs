//! StellarStack Daemon Library
//!
//! A production-grade Docker container management system inspired by Pterodactyl Wings.
//! This library provides comprehensive server lifecycle management, file operations,
//! real-time console access, and robust API communication with the StellarStack Panel.
//!
//! # Architecture
//!
//! The daemon is organized into specialized modules following domain-driven design:
//!
//! - **`server`** - Server lifecycle management (creation, power operations, installation)
//! - **`environment`** - Container runtime abstraction (Docker implementation)
//! - **`filesystem`** - Safe file operations with path traversal protection
//! - **`api`** - Panel API client with automatic retry logic
//! - **`router`** - HTTP REST API and WebSocket handlers
//! - **`events`** - Pub/Sub event system with Redis integration
//! - **`backup`** - Backup creation/restoration with multiple storage backends
//! - **`config`** - Configuration management and parsing
//! - **`database`** - State persistence and activity logging
//!
//! # Error Handling
//!
//! All modules use custom error types via the `thiserror` crate. This allows
//! precise error handling and automatic HTTP status code mapping for API responses.
//!
//! ```ignore
//! use stellar_daemon::server::{Manager, ServerConfig};
//!
//! #[tokio::main]
//! async fn main() -> Result<()> {
//!     let mut manager = Manager::new();
//!     manager.load_all().await?;
//!     Ok(())
//! }
//! ```
//!
//! # Type Safety
//!
//! The codebase maintains strict type safety throughout:
//! - No use of `any` types
//! - Custom error types for each module
//! - Result type aliases for ergonomic error handling
//! - Trait-based abstraction for extensibility

pub mod api;
pub mod backup;
pub mod config;
pub mod cron;
pub mod database;
pub mod environment;
pub mod events;
pub mod filesystem;
pub mod metrics;
pub mod parser;
pub mod router;
pub mod server;
pub mod sftp;
pub mod stats_buffer;
pub mod system;

// Re-export commonly used types
pub use config::Configuration;
pub use server::{Server, Manager};
pub use events::EventBus;
pub use stats_buffer::StatsBuffer;
pub use metrics::MetricsCollector;

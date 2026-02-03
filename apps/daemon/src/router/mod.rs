//! HTTP router module
//!
//! Provides the REST API for server management, file operations,
//! backups, and WebSocket connections.

mod handlers;
mod middleware;
mod websocket;

pub use handlers::*;
pub use middleware::*;
pub use websocket::WebsocketHandler;

use std::sync::Arc;

use axum::{
    Router,
    routing::{get, post, delete},
};
use tower_http::{
    cors::{CorsLayer, Any},
    trace::TraceLayer,
};

use crate::api::HttpClient;
use crate::config::Configuration;
use crate::server::Manager;
use crate::stats_buffer::StatsBuffer;

/// Application state shared across handlers
#[derive(Clone)]
pub struct AppState {
    /// Server manager
    pub manager: Arc<Manager>,

    /// API client for panel communication
    pub api_client: Arc<HttpClient>,

    /// Global configuration
    pub config: Arc<Configuration>,

    /// Stats buffer for maintaining recent server stats
    pub stats_buffer: StatsBuffer,
}

/// Build the HTTP router with all routes
pub fn build_router(state: AppState) -> Router {
    // Server-specific routes with server extraction middleware
    let server_routes_with_middleware = server_routes()
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            middleware::server::extract_server,
        ));

    let api_routes = Router::new()
        // System routes
        .route("/system", get(handlers::system::system_info))
        .route("/stats", get(handlers::system::hardware_stats))

        // Server collection routes
        .route("/servers", get(handlers::servers::list_servers))
        .route("/servers", post(handlers::servers::create_server))

        // Individual server routes (with server extraction middleware)
        .nest("/servers/:server_id", server_routes_with_middleware)

        // Apply auth middleware to all API routes
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            middleware::auth::require_auth,
        ));

    Router::new()
        // API routes (protected)
        .nest("/api", api_routes)

        // Public routes (file downloads with token auth)
        .route("/download/backup", get(handlers::download::download_backup))
        .route("/download/file", get(handlers::download::download_file))

        // Public upload route (legacy token-based)
        .route("/upload/file", post(handlers::upload::upload_file))

        // Apply global middleware
        .layer(TraceLayer::new_for_http())
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .with_state(state)
}

/// Routes for individual server operations
fn server_routes() -> Router<AppState> {
    Router::new()
        // Server info
        .route("/", get(handlers::servers::get_server))
        .route("/", delete(handlers::servers::delete_server))
        .route("/", axum::routing::patch(handlers::servers::update_server))

        // Power operations
        .route("/power", post(handlers::servers::power_action))

        // Console
        .route("/commands", post(handlers::servers::send_command))
        .route("/logs", get(handlers::servers::get_logs))

        // Installation
        .route("/install", post(handlers::servers::install_server))
        .route("/reinstall", post(handlers::servers::reinstall_server))

        // Sync
        .route("/sync", post(handlers::servers::sync_server))

        // WebSocket
        .route("/ws", get(websocket::ws_handler))

        // File routes
        .nest("/files", file_routes())

        // Backup routes
        .nest("/backup", backup_routes())

        // Transfer routes
        .nest("/transfer", transfer_routes())

        // Schedule routes
        .nest("/schedules", schedule_routes())

        // Plugin operations routes
        .nest("/plugins", plugin_routes())
}

/// Routes for server transfer operations
fn transfer_routes() -> Router<AppState> {
    Router::new()
        .route("/", post(handlers::transfer::initiate_transfer))
        .route("/", get(handlers::transfer::transfer_status))
        .route("/receive", post(handlers::transfer::receive_transfer))
        .route("/cancel", post(handlers::transfer::cancel_transfer))
}

/// Routes for file operations
fn file_routes() -> Router<AppState> {
    Router::new()
        .route("/list", get(handlers::files::list_files))
        .route("/contents", get(handlers::files::read_file))
        .route("/write", post(handlers::files::write_file))
        .route("/create", post(handlers::files::create_file))
        .route("/upload", post(handlers::upload::authenticated_upload_file))
        .route("/create-directory", post(handlers::files::create_directory))
        .route("/rename", post(handlers::files::rename_file))
        .route("/copy", post(handlers::files::copy_file))
        .route("/delete", delete(handlers::files::delete_files))
        .route("/compress", post(handlers::files::compress_files))
        .route("/decompress", post(handlers::files::decompress_file))
        .route("/chmod", post(handlers::files::chmod_file))
        .route("/disk-usage", get(handlers::files::disk_usage))
        .route("/pull", post(handlers::files::pull_file))
}

/// Routes for backup operations
fn backup_routes() -> Router<AppState> {
    Router::new()
        .route("/", get(handlers::backup::list_backups))
        .route("/", post(handlers::backup::create_backup))
        .route("/restore", post(handlers::backup::restore_backup))
        .route("/:backup_id", delete(handlers::backup::delete_backup))
}

/// Routes for schedule operations
fn schedule_routes() -> Router<AppState> {
    Router::new()
        .route("/sync", post(handlers::schedules::sync_schedules))
        .route("/:scheduleId/run", post(handlers::schedules::execute_schedule))
        .route("/", post(handlers::schedules::create_schedule))
        .route("/", axum::routing::patch(handlers::schedules::update_schedule))
        .route("/", delete(handlers::schedules::delete_schedule))
}

/// Routes for plugin operations
fn plugin_routes() -> Router<AppState> {
    Router::new()
        // File download for plugins
        .route("/download", post(handlers::plugins::download_file))
        // File write for plugins
        .route("/write", post(handlers::plugins::write_file))
        // File delete for plugins
        .route("/delete", delete(handlers::plugins::delete_file))
        // Delete all files for plugins
        .route("/delete-all", delete(handlers::plugins::delete_all_files))
        // Backup creation
        .route("/backup", post(handlers::plugins::create_backup))
        // Server control (start, stop, restart)
        .route("/control", post(handlers::plugins::control_server))
        // Send console command
        .route("/command", post(handlers::plugins::send_command))
}

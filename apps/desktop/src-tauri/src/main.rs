// Prevents an additional console window on Windows in release mode.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use log::info;
use std::sync::Arc;
use tauri::Manager;
use tokio::sync::Mutex;

use stellar_desktop_lib::config::AppConfig;
use stellar_desktop_lib::docker::DockerManager;
use stellar_desktop_lib::setup;
use stellar_desktop_lib::sidecar::SidecarManager;
use stellar_desktop_lib::tray;

/// Shared application state accessible from IPC commands.
struct AppState {
    config: Mutex<AppConfig>,
    docker: Mutex<Option<DockerManager>>,
    sidecars: Arc<SidecarManager>,
    data_dir: std::path::PathBuf,
    resource_dir: std::path::PathBuf,
    /// Path to the apps/api directory (source in dev, resources in prod).
    api_dir: std::path::PathBuf,
    /// Path to the apps/web directory for running `next dev` / `next start`.
    web_dir: std::path::PathBuf,
    /// Path to the daemon binary.
    daemon_binary: std::path::PathBuf,
}

// ── IPC Commands ────────────────────────────────────────────────────────────

/// Check whether Docker is reachable.
#[tauri::command]
async fn check_docker(state: tauri::State<'_, AppState>) -> Result<bool, String> {
    let docker = DockerManager::connect().map_err(|e| e.to_string())?;
    docker
        .check_connection()
        .await
        .map_err(|e| e.to_string())?;
    *state.docker.lock().await = Some(docker);
    Ok(true)
}

/// Start PostgreSQL and Redis containers.
#[tauri::command]
async fn start_docker_services(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let config = state.config.lock().await;
    let guard = state.docker.lock().await;
    let docker = guard.as_ref().ok_or("Docker not connected")?;

    docker
        .start_postgres(&config.db_password, &app)
        .await
        .map_err(|e| e.to_string())?;
    docker
        .start_redis(&app)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Stop Docker containers.
#[tauri::command]
async fn stop_docker_services(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let guard = state.docker.lock().await;
    if let Some(docker) = guard.as_ref() {
        docker.stop_services().await.map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Run Prisma database migrations.
#[tauri::command]
async fn run_migrations(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let config = state.config.lock().await;
    // In dev mode, use the API source dir (apps/api/prisma/schema.prisma).
    // In prod, use the resources dir where schema was copied.
    setup::run_migrations(&app, &state.api_dir, &config.database_url())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Start the API sidecar process.
#[tauri::command]
async fn start_api(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let config = state.config.lock().await;
    let mut env_vars = config.api_env_vars();

    // In dev mode, point FRONTEND_URL to the Next.js dev server (port 3000)
    if cfg!(debug_assertions) {
        env_vars.retain(|(k, _)| k != "FRONTEND_URL");
        env_vars.push(("FRONTEND_URL".into(), "http://localhost:3000".into()));
    }

    state
        .sidecars
        .start_api(&app, env_vars, state.api_dir.clone())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Start the Next.js frontend sidecar process.
#[tauri::command]
async fn start_web(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let config = state.config.lock().await;
    state
        .sidecars
        .start_web(&app, state.web_dir.clone(), config.api_port)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Start the Daemon sidecar process.
#[tauri::command]
async fn start_daemon(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let config = state.config.lock().await;
    let config_path = config
        .write_daemon_config(&state.data_dir)
        .map_err(|e| e.to_string())?;
    state
        .sidecars
        .start_daemon(&app, config_path, state.daemon_binary.clone())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Return whether first-run setup has been completed.
#[tauri::command]
async fn is_initialized(state: tauri::State<'_, AppState>) -> Result<bool, String> {
    Ok(setup::is_initialized(&state.data_dir))
}

/// Persist updated config values (called after setup wizard).
#[tauri::command]
async fn save_config(
    state: tauri::State<'_, AppState>,
    daemon_token_id: String,
    daemon_token: String,
) -> Result<(), String> {
    let mut config = state.config.lock().await;
    config.initialized = true;
    config.daemon_token_id = daemon_token_id;
    config.daemon_token = daemon_token;
    config.save(&state.data_dir).map_err(|e| e.to_string())?;
    Ok(())
}

/// Get the current config values needed by the splash page.
#[tauri::command]
async fn get_config(state: tauri::State<'_, AppState>) -> Result<serde_json::Value, String> {
    let config = state.config.lock().await;
    serde_json::to_value(&*config).map_err(|e| e.to_string())
}

// ── Entry Point ─────────────────────────────────────────────────────────────

fn main() {
    env_logger::init();

    // Keep a handle to sidecars for shutdown (std::sync::Mutex since setup runs outside Tokio)
    let sidecars_for_shutdown: Arc<std::sync::Mutex<Option<Arc<SidecarManager>>>> =
        Arc::new(std::sync::Mutex::new(None));
    let sidecars_ref = sidecars_for_shutdown.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .on_window_event(move |window, event| {
            match event {
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    // Hide to tray instead of closing
                    api.prevent_close();
                    let _ = window.hide();
                }
                _ => {}
            }
        })
        .setup(move |app| {
            let app_handle = app.handle().clone();

            // Resolve data and resource directories
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to resolve app data directory");
            std::fs::create_dir_all(&data_dir).expect("Failed to create app data directory");

            let resource_dir = app
                .path()
                .resource_dir()
                .expect("Failed to resolve resource directory");

            // Resolve the API directory (apps/api)
            // In dev: relative to Cargo manifest dir (apps/desktop/src-tauri)
            // In prod: relative to resource dir
            let api_dir = if cfg!(debug_assertions) {
                std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                    .join("..")
                    .join("..")
                    .join("api")
            } else {
                resource_dir.clone()
            };

            // Resolve the web app directory (apps/web)
            // In dev: relative to Cargo manifest dir (apps/desktop/src-tauri)
            // In prod: relative to resource dir
            let web_dir = if cfg!(debug_assertions) {
                std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                    .join("..")
                    .join("..")
                    .join("web")
            } else {
                resource_dir.join("web")
            };

            // Resolve daemon binary path
            // In dev: use the pre-built binary in src-tauri/binaries/
            // In prod: resolved from externalBin by Tauri
            let daemon_binary = if cfg!(debug_assertions) {
                let target_triple = if cfg!(target_os = "windows") {
                    "x86_64-pc-windows-msvc"
                } else if cfg!(target_os = "macos") {
                    "x86_64-apple-darwin"
                } else {
                    "x86_64-unknown-linux-gnu"
                };
                let ext = if cfg!(target_os = "windows") { ".exe" } else { "" };
                std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                    .join("binaries")
                    .join(format!("stellar-daemon-{}{}", target_triple, ext))
            } else {
                resource_dir.join("stellar-daemon")
            };

            info!("Data dir: {:?}", data_dir);
            info!("Resource dir: {:?}", resource_dir);
            info!("API dir: {:?}", api_dir);
            info!("Web dir: {:?}", web_dir);
            info!("Daemon binary: {:?}", daemon_binary);

            // Load or create configuration
            let config =
                AppConfig::load_or_create(&data_dir).expect("Failed to load configuration");

            // Shared state
            let sidecars = Arc::new(SidecarManager::new());

            // Store reference for shutdown
            *sidecars_ref.lock().unwrap() = Some(sidecars.clone());

            app.manage(AppState {
                config: Mutex::new(config),
                docker: Mutex::new(None),
                sidecars,
                data_dir,
                resource_dir,
                api_dir,
                web_dir,
                daemon_binary,
            });

            // System tray
            let _ = tray::create_tray(&app_handle);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            check_docker,
            start_docker_services,
            stop_docker_services,
            run_migrations,
            start_api,
            start_web,
            start_daemon,
            is_initialized,
            save_config,
            get_config,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(move |_app, event| {
            if let tauri::RunEvent::ExitRequested { .. } = event {
                let sidecars = sidecars_for_shutdown.clone();
                tauri::async_runtime::spawn(async move {
                    // Clone the Arc out of the guard so we don't hold MutexGuard across awaits
                    let sidecars_opt = sidecars.lock().unwrap().clone();
                    if let Some(ref s) = sidecars_opt {
                        info!("Shutting down sidecars...");
                        s.stop_all().await;
                    }
                    if let Ok(docker) = DockerManager::connect() {
                        let _ = docker.stop_services().await;
                    }
                    info!("Shutdown complete");
                });
            }
        });
}

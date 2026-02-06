use crate::config::AppConfig;
use anyhow::{Context, Result};
use log::info;
use std::path::Path;
use tauri::Emitter;

/// Check whether the first-run setup has been completed.
pub fn is_initialized(data_dir: &Path) -> bool {
    let config_path = data_dir.join("config.json");
    if !config_path.exists() {
        return false;
    }

    match std::fs::read_to_string(&config_path) {
        Ok(contents) => match serde_json::from_str::<AppConfig>(&contents) {
            Ok(cfg) => cfg.initialized,
            Err(_) => false,
        },
        Err(_) => false,
    }
}

/// Run Prisma migrations against the configured database.
pub async fn run_migrations(
    app: &tauri::AppHandle,
    resource_dir: &Path,
    database_url: &str,
) -> Result<()> {
    info!("Running Prisma migrations...");
    let _ = app.emit("startup-status", "Running database migrations...");

    let schema_path = resource_dir.join("prisma").join("schema.prisma");
    let schema_str = schema_path.to_string_lossy().to_string();

    // Use node directly with the Prisma CLI to avoid cmd /c npx chain
    // which silently fails on Windows when spawned from a GUI process.
    // Set current_dir to the API directory so Prisma resolves the local version
    // (global npx may find a different version like Prisma 7 with breaking changes).
    let prisma_cli = resource_dir
        .join("node_modules")
        .join("prisma")
        .join("build")
        .join("index.js");

    let output = tokio::process::Command::new("node")
        .arg(prisma_cli.to_string_lossy().to_string())
        .args(["migrate", "deploy", "--schema", &schema_str])
        .current_dir(resource_dir)
        .env("DATABASE_URL", database_url)
        .output()
        .await
        .context("Failed to spawn prisma migrate")?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    if !stdout.is_empty() {
        info!("[Prisma] {}", stdout);
    }
    if !stderr.is_empty() {
        info!("[Prisma] {}", stderr);
    }

    if !output.status.success() {
        anyhow::bail!(
            "Prisma migrate failed with exit code: {:?}\n{}",
            output.status.code(),
            stderr
        );
    }

    info!("Prisma migrations completed successfully");
    Ok(())
}

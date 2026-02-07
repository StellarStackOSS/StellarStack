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

/// Run Prisma migrations and generate client against the configured database.
pub async fn run_migrations(
    app: &tauri::AppHandle,
    resource_dir: &Path,
    database_url: &str,
) -> Result<()> {
    info!("Running Prisma migrations...");
    let _ = app.emit("startup-status", "Running database migrations...");

    let schema_path = resource_dir.join("prisma").join("schema.prisma");
    let schema_str = schema_path.to_string_lossy().to_string();

    // Find node binary
    let node_path = find_node_binary();

    // Use node directly with the Prisma CLI to avoid cmd /c npx chain
    // which silently fails on Windows when spawned from a GUI process.
    // Set current_dir to the API directory so Prisma resolves the local version
    // (global npx may find a different version like Prisma 7 with breaking changes).
    let prisma_cli = resource_dir
        .join("node_modules")
        .join("prisma")
        .join("build")
        .join("index.js");

    info!("Using node: {}", node_path);
    info!("Using Prisma CLI: {:?}", prisma_cli);
    info!("Schema path: {:?}", schema_path);

    // Run migrate deploy
    let output = tokio::process::Command::new(&node_path)
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
        info!("[Prisma migrate] {}", stdout);
    }
    if !stderr.is_empty() {
        info!("[Prisma migrate] {}", stderr);
    }

    if !output.status.success() {
        anyhow::bail!(
            "Prisma migrate failed with exit code: {:?}\n{}",
            output.status.code(),
            stderr
        );
    }

    info!("Prisma migrations completed successfully");

    // Run prisma generate to create the client
    let _ = app.emit("startup-status", "Generating Prisma client...");
    info!("Generating Prisma client...");

    let output = tokio::process::Command::new(&node_path)
        .arg(prisma_cli.to_string_lossy().to_string())
        .args(["generate", "--schema", &schema_str])
        .current_dir(resource_dir)
        .env("DATABASE_URL", database_url)
        .output()
        .await
        .context("Failed to spawn prisma generate")?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    if !stdout.is_empty() {
        info!("[Prisma generate] {}", stdout);
    }
    if !stderr.is_empty() {
        info!("[Prisma generate] {}", stderr);
    }

    if !output.status.success() {
        anyhow::bail!(
            "Prisma generate failed with exit code: {:?}\n{}",
            output.status.code(),
            stderr
        );
    }

    info!("Prisma client generated successfully");
    Ok(())
}

/// Find the node binary, checking common installation paths on macOS.
fn find_node_binary() -> String {
    // First check if node is in PATH
    if let Ok(output) = std::process::Command::new("which").arg("node").output() {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path.is_empty() && std::path::Path::new(&path).exists() {
                return path;
            }
        }
    }

    let home = std::env::var("HOME").unwrap_or_default();

    // Check nvm versions directory
    if let Some(nvm_node) = find_nvm_node(&home) {
        return nvm_node;
    }

    // Common Node.js installation paths
    let common_paths = [
        "/opt/homebrew/bin/node",
        "/usr/local/bin/node",
        "/usr/bin/node",
    ];

    for path in &common_paths {
        if std::path::Path::new(path).exists() {
            return path.to_string();
        }
    }

    "node".to_string()
}

/// Find node binary in nvm's versioned directory structure.
fn find_nvm_node(home: &str) -> Option<String> {
    let nvm_dir = format!("{}/.nvm/versions/node", home);
    let nvm_path = std::path::Path::new(&nvm_dir);

    if !nvm_path.exists() {
        return None;
    }

    let mut versions: Vec<_> = std::fs::read_dir(nvm_path)
        .ok()?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().is_dir())
        .map(|e| e.path())
        .collect();

    versions.sort();
    versions.reverse();

    for version_dir in versions {
        let node_bin = version_dir.join("bin").join("node");
        if node_bin.exists() {
            return Some(node_bin.to_string_lossy().to_string());
        }
    }

    None
}

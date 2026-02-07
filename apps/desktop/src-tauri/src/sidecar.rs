use anyhow::{Context, Result};
use log::{info, warn};
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::sync::Mutex;
use tokio::time::{sleep, Duration};

/// Clean up any stale processes from previous runs.
/// Kills processes on API (3001), Web (3000), and Daemon (8080) ports.
pub fn cleanup_stale_processes() {
    info!("Cleaning up stale processes from previous runs...");
    kill_process_on_port(3000); // Web
    kill_process_on_port(3001); // API
    kill_process_on_port(8080); // Daemon
}

/// Kill any process using the specified port.
/// This is used to clean up stale processes from previous runs.
fn kill_process_on_port(port: u16) {
    #[cfg(unix)]
    {
        // Use lsof to find process on port, then kill it
        if let Ok(output) = std::process::Command::new("lsof")
            .args(["-ti", &format!(":{}", port)])
            .output()
        {
            let pids = String::from_utf8_lossy(&output.stdout);
            for pid in pids.lines() {
                if let Ok(pid_num) = pid.trim().parse::<i32>() {
                    info!("Killing stale process {} on port {}", pid_num, port);
                    let _ = std::process::Command::new("kill")
                        .args(["-9", &pid_num.to_string()])
                        .output();
                }
            }
        }
    }

    #[cfg(windows)]
    {
        // Use netstat to find process, then taskkill
        if let Ok(output) = std::process::Command::new("netstat")
            .args(["-ano"])
            .output()
        {
            let output_str = String::from_utf8_lossy(&output.stdout);
            for line in output_str.lines() {
                if line.contains(&format!(":{}", port)) && line.contains("LISTENING") {
                    if let Some(pid) = line.split_whitespace().last() {
                        info!("Killing stale process {} on port {}", pid, port);
                        let _ = std::process::Command::new("taskkill")
                            .args(["/F", "/PID", pid])
                            .output();
                    }
                }
            }
        }
    }
}

/// Maximum restart attempts before giving up on a sidecar.
#[allow(dead_code)]
const MAX_RESTARTS: u32 = 3;

/// Tracks the state of a single sidecar process.
struct SidecarState {
    name: String,
    child: Option<tokio::process::Child>,
    restart_count: u32,
}

/// Manages the lifecycle of the API, Web, and Daemon sidecar processes.
pub struct SidecarManager {
    api: Arc<Mutex<SidecarState>>,
    web: Arc<Mutex<SidecarState>>,
    daemon: Arc<Mutex<SidecarState>>,
}

impl SidecarManager {
    /// Create a new manager with no running processes.
    pub fn new() -> Self {
        Self {
            api: Arc::new(Mutex::new(SidecarState {
                name: "API".into(),
                child: None,
                restart_count: 0,
            })),
            web: Arc::new(Mutex::new(SidecarState {
                name: "Web".into(),
                child: None,
                restart_count: 0,
            })),
            daemon: Arc::new(Mutex::new(SidecarState {
                name: "Daemon".into(),
                child: None,
                restart_count: 0,
            })),
        }
    }

    /// Start the API sidecar (Node.js process running the bundled API).
    ///
    /// In dev mode, runs `node node_modules/tsx/dist/cli.mjs src/index.ts`
    /// from the API source directory. Using node directly avoids the
    /// `cmd /c npx` process chain which silently fails on Windows when
    /// spawned from a GUI process with piped stdio.
    /// In production, runs the esbuild bundle.
    pub async fn start_api(
        &self,
        app: &AppHandle,
        env_vars: Vec<(String, String)>,
        working_dir: PathBuf,
    ) -> Result<()> {
        let _ = app.emit("startup-status", format!("Starting API server from {:?}...", working_dir));
        info!("Starting API server from {:?}", working_dir);

        // Kill any stale process on the API port
        kill_process_on_port(3001);

        // Find node binary - check common locations on macOS
        let node_path = find_node_binary();
        info!("Using node binary: {:?}", node_path);

        let mut cmd = if cfg!(debug_assertions) {
            // Dev mode: call node directly with tsx CLI to avoid cmd /c npx chain
            let tsx_cli = working_dir
                .join("node_modules")
                .join("tsx")
                .join("dist")
                .join("cli.mjs");

            info!("Looking for tsx CLI at: {:?}", tsx_cli);
            if !tsx_cli.exists() {
                let err_msg = format!("tsx CLI not found at {:?}. Run 'pnpm install' in the api directory.", tsx_cli);
                let _ = app.emit("sidecar-log", format!("[API] ERROR: {}", err_msg));
                anyhow::bail!(err_msg);
            }

            let _ = app.emit(
                "sidecar-log",
                format!("[API] Using tsx CLI at: {:?}", tsx_cli),
            );
            let mut c = tokio::process::Command::new(&node_path);
            c.arg(tsx_cli.to_string_lossy().to_string());
            c.arg("src/index.ts");
            c.current_dir(&working_dir);
            c
        } else {
            // Production: run the esbuild-bundled CJS file
            let bundle_path = working_dir.join("api-bundle").join("api-bundle.cjs");
            info!("Looking for API bundle at: {:?}", bundle_path);
            if !bundle_path.exists() {
                let err_msg = format!("API bundle not found at {:?}", bundle_path);
                let _ = app.emit("sidecar-log", format!("[API] ERROR: {}", err_msg));
                anyhow::bail!(err_msg);
            }
            let mut c = tokio::process::Command::new(&node_path);
            c.arg(bundle_path.to_string_lossy().to_string());
            c
        };

        for (key, value) in &env_vars {
            cmd.env(key, value);
        }

        // Log PATH for debugging
        info!("Current PATH: {:?}", std::env::var("PATH").unwrap_or_default());

        cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

        let mut child = cmd.spawn().with_context(|| {
            format!("Failed to spawn API sidecar. Node path: {:?}, Working dir: {:?}", node_path, working_dir)
        })?;

        // Stream stdout/stderr to logs
        let stdout = child.stdout.take();
        let stderr = child.stderr.take();
        spawn_log_reader("API", stdout, stderr, app.clone());

        {
            let mut state = self.api.lock().await;
            state.child = Some(child);
        }

        self.wait_for_health(app, 3001, "/health", "API").await?;

        let _ = app.emit("startup-status", "API server is ready");
        Ok(())
    }

    /// Start the Next.js frontend server.
    ///
    /// In dev mode, runs `node node_modules/next/dist/bin/next dev`.
    /// In production, runs `next start` against the pre-built output.
    /// Uses node directly to avoid the `cmd /c npx` chain issue on Windows.
    pub async fn start_web(
        &self,
        app: &AppHandle,
        web_dir: PathBuf,
        api_port: u16,
    ) -> Result<()> {
        let _ = app.emit("startup-status", "Starting frontend server...");
        info!("Starting frontend server from {:?}", web_dir);

        // Kill any stale process on the web port
        kill_process_on_port(3000);

        let next_cmd = if cfg!(debug_assertions) { "dev" } else { "start" };

        // Find node binary
        let node_path = find_node_binary();

        // Call node directly with the Next.js CLI
        let next_cli = web_dir
            .join("node_modules")
            .join("next")
            .join("dist")
            .join("bin")
            .join("next");

        info!("Looking for Next.js CLI at: {:?}", next_cli);
        if !next_cli.exists() {
            let err_msg = format!("Next.js CLI not found at {:?}. Run 'pnpm install' in the web directory.", next_cli);
            let _ = app.emit("sidecar-log", format!("[Web] ERROR: {}", err_msg));
            anyhow::bail!(err_msg);
        }

        let mut cmd = tokio::process::Command::new(&node_path);
        cmd.arg(next_cli.to_string_lossy().to_string());
        cmd.args([next_cmd, "-p", "3000"]);
        cmd.current_dir(&web_dir)
            .env("HOSTNAME", "127.0.0.1")
            .env("HOST", "127.0.0.1")
            .env(
                "NEXT_PUBLIC_API_URL",
                format!("http://localhost:{}", api_port),
            )
            .env("NEXT_PUBLIC_DESKTOP_MODE", "true")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let mut child = cmd.spawn().context("Failed to spawn web sidecar")?;

        let stdout = child.stdout.take();
        let stderr = child.stderr.take();
        spawn_log_reader("Web", stdout, stderr, app.clone());

        {
            let mut state = self.web.lock().await;
            state.child = Some(child);
        }

        self.wait_for_health(app, 3000, "/", "Web").await?;

        let _ = app.emit("startup-status", "Frontend server is ready");
        Ok(())
    }

    /// Poll a health endpoint until it responds OK (max 60 seconds).
    async fn wait_for_health(&self, app: &AppHandle, port: u16, path: &str, name: &str) -> Result<()> {
        let url = format!("http://127.0.0.1:{}{}", port, path);

        for i in 0..120 {
            match reqwest_lite_get(&url).await {
                Ok(true) => {
                    info!("{} health check passed after {}ms", name, i * 500);
                    return Ok(());
                }
                _ => {
                    let _ = app.emit(
                        "startup-status",
                        format!("Waiting for {}... ({}/120)", name, i + 1),
                    );
                    sleep(Duration::from_millis(500)).await;
                }
            }
        }

        anyhow::bail!("{} did not become healthy within 60 seconds", name)
    }

    /// Start the Daemon sidecar (Rust binary).
    pub async fn start_daemon(
        &self,
        app: &AppHandle,
        config_path: PathBuf,
        daemon_binary: PathBuf,
    ) -> Result<()> {
        let _ = app.emit("startup-status", "Starting daemon...");

        let mut cmd = tokio::process::Command::new(&daemon_binary);
        cmd.arg("--config")
            .arg(config_path.to_string_lossy().to_string())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let mut child = cmd.spawn().context("Failed to spawn daemon sidecar")?;

        let stdout = child.stdout.take();
        let stderr = child.stderr.take();
        spawn_log_reader("Daemon", stdout, stderr, app.clone());

        {
            let mut state = self.daemon.lock().await;
            state.child = Some(child);
        }

        let _ = app.emit("startup-status", "Daemon is running");
        Ok(())
    }

    /// Send kill signals to all sidecars.
    pub async fn stop_all(&self) {
        info!("Stopping all sidecars...");

        if let Some(ref mut child) = self.api.lock().await.child {
            let _ = child.kill().await;
            info!("API sidecar stopped");
        }

        if let Some(ref mut child) = self.web.lock().await.child {
            let _ = child.kill().await;
            info!("Web sidecar stopped");
        }

        if let Some(ref mut child) = self.daemon.lock().await.child {
            let _ = child.kill().await;
            info!("Daemon sidecar stopped");
        }
    }
}

/// Spawn background tasks that read stdout/stderr and log them.
fn spawn_log_reader(
    name: &'static str,
    stdout: Option<tokio::process::ChildStdout>,
    stderr: Option<tokio::process::ChildStderr>,
    app: AppHandle,
) {
    if let Some(stdout) = stdout {
        let app_stdout = app.clone();
        tokio::spawn(async move {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                info!("[{}] {}", name, line);
                let _ = app_stdout.emit("sidecar-log", format!("[{} stdout] {}", name, line));
            }
        });
    }

    if let Some(stderr) = stderr {
        let app = app.clone();
        tokio::spawn(async move {
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                warn!("[{}] {}", name, line);
                let _ = app.emit("sidecar-log", format!("[{}] {}", name, line));
            }
        });
    }
}

/// Find the node binary, checking common installation paths on macOS.
fn find_node_binary() -> String {
    // First check if node is in PATH
    if let Ok(output) = std::process::Command::new("which").arg("node").output() {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path.is_empty() && std::path::Path::new(&path).exists() {
                info!("Found node via which: {}", path);
                return path;
            }
        }
    }

    let home = std::env::var("HOME").unwrap_or_default();

    // Check nvm versions directory (nvm uses versioned paths, not a 'current' symlink)
    if let Some(nvm_node) = find_nvm_node(&home) {
        info!("Found node via nvm: {}", nvm_node);
        return nvm_node;
    }

    // Common Node.js installation paths on macOS
    let common_paths = [
        "/opt/homebrew/bin/node".to_string(),        // Homebrew Apple Silicon
        "/usr/local/bin/node".to_string(),           // Homebrew Intel
        "/usr/bin/node".to_string(),                 // System
        format!("{}/.nvm/current/bin/node", home),   // nvm current symlink (if exists)
        format!("{}/.volta/bin/node", home),         // volta
        format!("{}/.asdf/shims/node", home),        // asdf
        format!("{}/.local/bin/node", home),         // local
        "/opt/local/bin/node".to_string(),           // MacPorts
    ];

    for path in &common_paths {
        if std::path::Path::new(path).exists() {
            info!("Found node at common path: {}", path);
            return path.clone();
        }
    }

    // Fall back to just "node" and hope it's in PATH
    warn!("Could not find node binary, falling back to 'node'");
    "node".to_string()
}

/// Find node binary in nvm's versioned directory structure.
fn find_nvm_node(home: &str) -> Option<String> {
    let nvm_dir = format!("{}/.nvm/versions/node", home);
    let nvm_path = std::path::Path::new(&nvm_dir);

    if !nvm_path.exists() {
        return None;
    }

    // Read the directory and find the most recent version
    let mut versions: Vec<_> = std::fs::read_dir(nvm_path)
        .ok()?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().is_dir())
        .map(|e| e.path())
        .collect();

    // Sort by version (simple string sort works for semver with 'v' prefix)
    versions.sort();
    versions.reverse(); // Most recent first

    for version_dir in versions {
        let node_bin = version_dir.join("bin").join("node");
        if node_bin.exists() {
            return Some(node_bin.to_string_lossy().to_string());
        }
    }

    None
}

/// Minimal HTTP GET that returns Ok(true) when the response status is 2xx.
async fn reqwest_lite_get(url: &str) -> Result<bool> {
    let url: url::Url = url.parse()?;
    let host = url.host_str().unwrap_or("127.0.0.1");
    let port = url.port().unwrap_or(80);
    let path = url.path();

    let addr = format!("{}:{}", host, port);
    let mut stream = tokio::net::TcpStream::connect(&addr).await?;

    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    let request = format!("GET {} HTTP/1.0\r\nHost: {}\r\n\r\n", path, host);
    stream.write_all(request.as_bytes()).await?;

    let mut buf = vec![0u8; 1024];
    let n = stream.read(&mut buf).await?;
    let response = String::from_utf8_lossy(&buf[..n]);

    Ok(response.contains("200") || response.contains("302") || response.contains("307"))
}

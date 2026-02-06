use anyhow::{Context, Result};
use bollard::container::{
    Config, CreateContainerOptions, ListContainersOptions, StartContainerOptions,
    StopContainerOptions,
};
use bollard::image::CreateImageOptions;
use bollard::models::{ContainerStateStatusEnum, HostConfig, Mount, MountTypeEnum, PortBinding};
use bollard::volume::CreateVolumeOptions;
use bollard::Docker;
use futures::StreamExt;
use log::{error, info, warn};
use std::collections::HashMap;
use tauri::{AppHandle, Emitter};

const PG_CONTAINER: &str = "stellarstack-desktop-postgres";
const PG_IMAGE: &str = "postgres:16-alpine";
const PG_VOLUME: &str = "stellarstack-desktop-pgdata";

const REDIS_CONTAINER: &str = "stellarstack-desktop-redis";
const REDIS_IMAGE: &str = "redis:7-alpine";
const REDIS_VOLUME: &str = "stellarstack-desktop-redisdata";

/// Manages Docker containers for PostgreSQL and Redis.
pub struct DockerManager {
    client: Docker,
}

impl DockerManager {
    /// Connect to the local Docker daemon (auto-detects socket type).
    pub fn connect() -> Result<Self> {
        let client =
            Docker::connect_with_local_defaults().context("Failed to connect to Docker daemon")?;
        Ok(Self { client })
    }

    /// Verify the Docker daemon is reachable.
    pub async fn check_connection(&self) -> Result<()> {
        self.client
            .ping()
            .await
            .context("Docker daemon is not reachable")?;
        Ok(())
    }

    /// Pull a Docker image, emitting progress events to the frontend.
    async fn pull_image(&self, image: &str, app: &AppHandle) -> Result<()> {
        info!("Pulling image: {}", image);
        let _ = app.emit("docker-progress", format!("Pulling {}...", image));

        let options = CreateImageOptions {
            from_image: image,
            ..Default::default()
        };

        let mut stream = self.client.create_image(Some(options), None, None);
        while let Some(result) = stream.next().await {
            match result {
                Ok(info) => {
                    if let Some(status) = &info.status {
                        let _ = app.emit(
                            "docker-progress",
                            format!("{}: {}", image, status),
                        );
                    }
                }
                Err(e) => {
                    error!("Error pulling {}: {}", image, e);
                    return Err(e.into());
                }
            }
        }

        info!("Finished pulling: {}", image);
        Ok(())
    }

    /// Ensure a named Docker volume exists.
    async fn ensure_volume(&self, name: &str) -> Result<()> {
        let options: CreateVolumeOptions<String> = CreateVolumeOptions {
            name: name.into(),
            ..Default::default()
        };
        self.client.create_volume(options).await?;
        Ok(())
    }

    /// Check if a container exists and is running.
    async fn container_status(&self, name: &str) -> Result<Option<ContainerStateStatusEnum>> {
        let mut filters = HashMap::new();
        filters.insert("name".to_string(), vec![name.to_string()]);

        let options = ListContainersOptions {
            all: true,
            filters,
            ..Default::default()
        };

        let containers = self.client.list_containers(Some(options)).await?;
        for container in &containers {
            if let Some(names) = &container.names {
                if names.iter().any(|n| n == &format!("/{}", name) || n == name) {
                    if let Some(state) = &container.state {
                        return Ok(Some(match state.as_str() {
                            "running" => ContainerStateStatusEnum::RUNNING,
                            "exited" => ContainerStateStatusEnum::EXITED,
                            "created" => ContainerStateStatusEnum::CREATED,
                            "paused" => ContainerStateStatusEnum::PAUSED,
                            _ => ContainerStateStatusEnum::EXITED,
                        }));
                    }
                }
            }
        }
        Ok(None)
    }

    /// Start PostgreSQL container, creating it if necessary.
    pub async fn start_postgres(&self, db_password: &str, app: &AppHandle) -> Result<()> {
        let _ = app.emit("docker-progress", "Starting PostgreSQL...");

        // Ensure image is available
        self.pull_image(PG_IMAGE, app).await?;
        self.ensure_volume(PG_VOLUME).await?;

        let status = self.container_status(PG_CONTAINER).await?;

        match status {
            Some(ContainerStateStatusEnum::RUNNING) => {
                info!("PostgreSQL container already running");
                return Ok(());
            }
            Some(_) => {
                // Container exists but not running — start it
                info!("Starting existing PostgreSQL container");
                self.client
                    .start_container(PG_CONTAINER, None::<StartContainerOptions<String>>)
                    .await?;
            }
            None => {
                // Create new container
                info!("Creating PostgreSQL container");
                let mut port_bindings = HashMap::new();
                port_bindings.insert(
                    "5432/tcp".to_string(),
                    Some(vec![PortBinding {
                        host_ip: Some("127.0.0.1".to_string()),
                        host_port: Some("5432".to_string()),
                    }]),
                );

                let config = Config {
                    image: Some(PG_IMAGE.to_string()),
                    env: Some(vec![
                        format!("POSTGRES_USER=stellar"),
                        format!("POSTGRES_PASSWORD={}", db_password),
                        format!("POSTGRES_DB=stellar"),
                    ]),
                    host_config: Some(HostConfig {
                        port_bindings: Some(port_bindings),
                        mounts: Some(vec![Mount {
                            target: Some("/var/lib/postgresql/data".to_string()),
                            source: Some(PG_VOLUME.to_string()),
                            typ: Some(MountTypeEnum::VOLUME),
                            ..Default::default()
                        }]),
                        restart_policy: Some(bollard::models::RestartPolicy {
                            name: Some(bollard::models::RestartPolicyNameEnum::UNLESS_STOPPED),
                            ..Default::default()
                        }),
                        ..Default::default()
                    }),
                    ..Default::default()
                };

                let options = CreateContainerOptions {
                    name: PG_CONTAINER,
                    ..Default::default()
                };

                self.client.create_container(Some(options), config).await?;
                self.client
                    .start_container(PG_CONTAINER, None::<StartContainerOptions<String>>)
                    .await?;
            }
        }

        // Wait for PostgreSQL to become healthy
        self.wait_for_pg_ready(app).await?;
        Ok(())
    }

    /// Poll PostgreSQL until it accepts connections (max 30 seconds).
    async fn wait_for_pg_ready(&self, app: &AppHandle) -> Result<()> {
        let _ = app.emit("docker-progress", "Waiting for PostgreSQL to be ready...");

        for i in 0..60 {
            let exec = self
                .client
                .create_exec(
                    PG_CONTAINER,
                    bollard::exec::CreateExecOptions {
                        cmd: Some(vec![
                            "pg_isready",
                            "-U",
                            "stellar",
                        ]),
                        attach_stdout: Some(true),
                        attach_stderr: Some(true),
                        ..Default::default()
                    },
                )
                .await?;

            let result = self
                .client
                .start_exec(&exec.id, None)
                .await?;

            if let bollard::exec::StartExecResults::Attached { mut output, .. } = result {
                // Consume output
                while let Some(_) = output.next().await {}
            }

            let inspect = self.client.inspect_exec(&exec.id).await?;
            if inspect.exit_code == Some(0) {
                info!("PostgreSQL is ready after {}ms", i * 500);
                let _ = app.emit("docker-progress", "PostgreSQL is ready");
                return Ok(());
            }

            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        }

        anyhow::bail!("PostgreSQL did not become ready within 30 seconds")
    }

    /// Start Redis container, creating it if necessary.
    pub async fn start_redis(&self, app: &AppHandle) -> Result<()> {
        let _ = app.emit("docker-progress", "Starting Redis...");

        self.pull_image(REDIS_IMAGE, app).await?;
        self.ensure_volume(REDIS_VOLUME).await?;

        let status = self.container_status(REDIS_CONTAINER).await?;

        match status {
            Some(ContainerStateStatusEnum::RUNNING) => {
                info!("Redis container already running");
                return Ok(());
            }
            Some(_) => {
                info!("Starting existing Redis container");
                self.client
                    .start_container(REDIS_CONTAINER, None::<StartContainerOptions<String>>)
                    .await?;
            }
            None => {
                info!("Creating Redis container");
                let mut port_bindings = HashMap::new();
                port_bindings.insert(
                    "6379/tcp".to_string(),
                    Some(vec![PortBinding {
                        host_ip: Some("127.0.0.1".to_string()),
                        host_port: Some("6379".to_string()),
                    }]),
                );

                let config = Config {
                    image: Some(REDIS_IMAGE.to_string()),
                    cmd: Some(vec![
                        "redis-server".to_string(),
                        "--appendonly".to_string(),
                        "yes".to_string(),
                    ]),
                    host_config: Some(HostConfig {
                        port_bindings: Some(port_bindings),
                        mounts: Some(vec![Mount {
                            target: Some("/data".to_string()),
                            source: Some(REDIS_VOLUME.to_string()),
                            typ: Some(MountTypeEnum::VOLUME),
                            ..Default::default()
                        }]),
                        restart_policy: Some(bollard::models::RestartPolicy {
                            name: Some(bollard::models::RestartPolicyNameEnum::UNLESS_STOPPED),
                            ..Default::default()
                        }),
                        ..Default::default()
                    }),
                    ..Default::default()
                };

                let options = CreateContainerOptions {
                    name: REDIS_CONTAINER,
                    ..Default::default()
                };

                self.client.create_container(Some(options), config).await?;
                self.client
                    .start_container(REDIS_CONTAINER, None::<StartContainerOptions<String>>)
                    .await?;
            }
        }

        // Wait for Redis to become ready
        self.wait_for_redis_ready(app).await?;
        Ok(())
    }

    /// Poll Redis until it responds to PING (max 15 seconds).
    async fn wait_for_redis_ready(&self, app: &AppHandle) -> Result<()> {
        let _ = app.emit("docker-progress", "Waiting for Redis to be ready...");

        for i in 0..30 {
            let exec = self
                .client
                .create_exec(
                    REDIS_CONTAINER,
                    bollard::exec::CreateExecOptions {
                        cmd: Some(vec!["redis-cli", "ping"]),
                        attach_stdout: Some(true),
                        attach_stderr: Some(true),
                        ..Default::default()
                    },
                )
                .await?;

            let result = self.client.start_exec(&exec.id, None).await?;
            if let bollard::exec::StartExecResults::Attached { mut output, .. } = result {
                while let Some(_) = output.next().await {}
            }

            let inspect = self.client.inspect_exec(&exec.id).await?;
            if inspect.exit_code == Some(0) {
                info!("Redis is ready after {}ms", i * 500);
                let _ = app.emit("docker-progress", "Redis is ready");
                return Ok(());
            }

            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        }

        anyhow::bail!("Redis did not become ready within 15 seconds")
    }

    /// Stop both database containers gracefully.
    pub async fn stop_services(&self) -> Result<()> {
        info!("Stopping Docker services...");

        let stop_options = StopContainerOptions { t: 10 };

        if let Err(e) = self
            .client
            .stop_container(PG_CONTAINER, Some(stop_options.clone()))
            .await
        {
            warn!("Failed to stop PostgreSQL container: {}", e);
        }

        if let Err(e) = self
            .client
            .stop_container(REDIS_CONTAINER, Some(stop_options))
            .await
        {
            warn!("Failed to stop Redis container: {}", e);
        }

        info!("Docker services stopped");
        Ok(())
    }
}

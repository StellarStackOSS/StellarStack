# Plugin System - Daemon Integration Guide

## Overview

The plugin action system has been scaffolded with stub implementations. This guide explains what needs to be implemented in the daemon and API to actually execute plugin operations like file downloads, server control, and backups.

**Status**: 🟡 **Scaffolding complete, daemon integration pending**

## Current State

### ✅ Implemented (API Layer)

- Action schema validation
- Template variable resolution (`{{param}}`, `{{config.key}}`)
- Permission enforcement
- Backup creation triggers
- Operation type routing
- Request/response handling
- Error handling framework

### ⚠️ Stubbed (Need Daemon Integration)

- File downloads (`download-to-server`)
- File writes (`write-file`)
- File deletions (`delete-file`)
- Server commands (`send-command`)
- Server control (`start-server`, `stop-server`, `restart-server`)
- Backup creation (`create-backup`)

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     API Server                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │    PluginActionExecutor                           │ │
│  │  - Routes actions                                 │ │
│  │  - Validates permissions                          │ │
│  │  - Creates backups                                │ │
│  │  - Calls daemon operations                        │ │
│  └────────────────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP/REST
                       │
┌──────────────────────▼──────────────────────────────────┐
│                   Daemon                                │
│  ┌────────────────────────────────────────────────────┐ │
│  │    File Operations Service                        │ │
│  │  - Download files                                 │ │
│  │  - Write files                                    │ │
│  │  - Delete files                                   │ │
│  │  - Extract archives                               │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────┐ │
│  │    Server Control Service                         │ │
│  │  - Send console commands                          │ │
│  │  - Start/stop server                              │ │
│  │  - Monitor process                                │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────┐ │
│  │    Backup Service                                 │ │
│  │  - Create snapshots                               │ │
│  │  - List backups                                   │ │
│  │  - Restore from backup                            │ │
│  └────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

## Operations to Implement

### 1. download-to-server

**Purpose**: Download a file from a URL and save it to the server

**Schema**:
```json
{
  "type": "download-to-server",
  "url": "https://example.com/file.zip",
  "destPath": "/path/to/destination",
  "directory": "mods",
  "decompress": true,
  "headers": { "x-api-key": "{{config.apiKey}}" }
}
```

**Implementation Steps**:

1. **API Layer** (`plugin-executor.ts`):
   ```typescript
   private async executeDownload(
     operation: Operation,
     context: PluginContext
   ): Promise<void> {
     const { url, destPath, headers = {}, decompress = false } = operation as any;

     // Call daemon to download file
     const response = await this.daemonApi.downloadFile({
       serverId: context.serverId,
       url,
       destPath,
       headers,
       decompress
     });

     if (!response.success) {
       throw new Error(`Download failed: ${response.error}`);
     }
   }
   ```

2. **Daemon Layer** (Rust):
   ```rust
   pub async fn download_file(
     &self,
     request: DownloadFileRequest,
   ) -> Result<FileResponse> {
     // 1. Validate URL (not localhost, allowed domains)
     validate_url(&request.url)?;

     // 2. Create destination directory if needed
     fs::create_dir_all(&request.dest_path).await?;

     // 3. Download file with streaming
     let response = reqwest::get(&request.url).await?;
     let mut file = File::create(&request.dest_path).await?;
     let mut stream = response.bytes_stream();

     while let Some(chunk) = stream.next().await {
       file.write_all(&chunk?).await?;
     }

     // 4. Decompress if requested
     if request.decompress && request.dest_path.ends_with(".zip") {
       decompress_zip(&request.dest_path, &request.dest_path.parent()).await?;
     }

     Ok(FileResponse { success: true })
   }
   ```

3. **Key Considerations**:
   - ✅ Validate URLs (prevent SSRF attacks)
   - ✅ Stream large files (don't load in memory)
   - ✅ Support archive extraction (.zip, .tar.gz)
   - ✅ Resume interrupted downloads
   - ✅ Verify file checksums if provided
   - ✅ Limit concurrent downloads
   - ✅ Log all file operations for audit trail

### 2. write-file

**Purpose**: Write content to a file on the server

**Schema**:
```json
{
  "type": "write-file",
  "path": "/path/to/file.txt",
  "content": "File content here",
  "append": false,
  "mode": "644"
}
```

**Implementation Steps**:

1. **API Layer**:
   ```typescript
   private async executeWriteFile(
     operation: Operation,
     context: PluginContext
   ): Promise<void> {
     const { path, content, append = false } = operation as any;

     const response = await this.daemonApi.writeFile({
       serverId: context.serverId,
       path,
       content,
       append
     });

     if (!response.success) {
       throw new Error(`Write failed: ${response.error}`);
     }
   }
   ```

2. **Daemon Layer**:
   ```rust
   pub async fn write_file(
     &self,
     request: WriteFileRequest,
   ) -> Result<FileResponse> {
     // 1. Validate path (prevent directory traversal)
     validate_server_path(&request.path)?;

     // 2. Create parent directory if needed
     if let Some(parent) = Path::new(&request.path).parent() {
       fs::create_dir_all(parent).await?;
     }

     // 3. Write or append content
     let open_opts = if request.append {
       OpenOptions::new().append(true).create(true)
     } else {
       OpenOptions::new().write(true).create(true).truncate(true)
     };

     let mut file = open_opts.open(&request.path).await?;
     file.write_all(request.content.as_bytes()).await?;

     Ok(FileResponse { success: true })
   }
   ```

### 3. send-command

**Purpose**: Send a console command to the running server

**Schema**:
```json
{
  "type": "send-command",
  "command": "say {{message}}",
  "timeout": 5000
}
```

**Implementation Steps**:

1. **API Layer**:
   ```typescript
   private async executeSendCommand(
     operation: Operation,
     context: PluginContext
   ): Promise<void> {
     const { command, timeout = 5000 } = operation as any;

     const response = await this.daemonApi.sendCommand({
       serverId: context.serverId,
       command,
       timeout
     });

     if (!response.success) {
       throw new Error(`Command failed: ${response.error}`);
     }
   }
   ```

2. **Daemon Layer**:
   ```rust
   pub async fn send_command(
     &self,
     request: SendCommandRequest,
   ) -> Result<CommandResponse> {
     // 1. Get server process handle
     let server = self.get_server(&request.server_id)?;

     // 2. Check if server is running
     if !server.is_running() {
       return Err("Server is not running".into());
     }

     // 3. Send command to stdin (game-specific)
     server.send_input(&request.command).await?;

     // 4. Optionally wait for response with timeout
     if let Some(timeout) = Duration::from_millis(request.timeout) {
       tokio::time::timeout(timeout, server.wait_for_output()).await??;
     }

     Ok(CommandResponse { success: true })
   }
   ```

### 4. create-backup

**Purpose**: Create a backup snapshot before destructive operations

**Schema**:
```json
{
  "type": "create-backup",
  "backupName": "pre-modpack-install-2024-01-30"
}
```

**Implementation Steps**:

1. **API Layer**:
   ```typescript
   private async createPreActionBackup(
     context: PluginContext,
     backupName?: string
   ): Promise<string | null> {
     const name = backupName || `plugin-${context.pluginId}-${timestamp}`;

     const response = await this.daemonApi.createBackup({
       serverId: context.serverId,
       name,
       description: `Auto-backup before plugin action: ${context.pluginId}`
     });

     if (!response.success) {
       throw new Error(`Backup failed: ${response.error}`);
     }

     return response.backupId;
   }
   ```

2. **Daemon Layer**:
   ```rust
   pub async fn create_backup(
     &self,
     request: CreateBackupRequest,
   ) -> Result<BackupResponse> {
     // 1. Check available disk space
     let available = get_disk_space()?;
     if available < MINIMUM_BACKUP_SPACE {
       return Err("Insufficient disk space".into());
     }

     // 2. Stop server if configured
     let server = self.get_server(&request.server_id)?;
     let was_running = server.is_running();
     if was_running {
       server.stop(Duration::from_secs(30)).await?;
     }

     // 3. Create backup snapshot
     let backup_path = format!("/backups/{}/{}", &request.server_id, &request.name);
     fs::create_dir_all(&backup_path).await?;

     // Copy server directory
     copy_dir_all(&server.path, &backup_path).await?;

     // 4. Create metadata
     let metadata = BackupMetadata {
       id: generate_id(),
       name: request.name,
       size: get_dir_size(&backup_path).await?,
       created_at: Utc::now(),
       description: request.description,
     };

     save_metadata(&backup_path, &metadata).await?;

     // 5. Restart server if it was running
     if was_running {
       server.start().await?;
     }

     Ok(BackupResponse {
       success: true,
       backup_id: metadata.id
     })
   }
   ```

### 5. Server Control Operations

**start-server**, **stop-server**, **restart-server**

```typescript
private async executeStartServer(context: PluginContext): Promise<void> {
  const response = await this.daemonApi.startServer({
    serverId: context.serverId
  });
  if (!response.success) throw new Error(`Start failed: ${response.error}`);
}

private async executeStopServer(context: PluginContext): Promise<void> {
  const response = await this.daemonApi.stopServer({
    serverId: context.serverId,
    timeout: 30000 // Graceful shutdown timeout
  });
  if (!response.success) throw new Error(`Stop failed: ${response.error}`);
}

private async executeRestartServer(context: PluginContext): Promise<void> {
  const response = await this.daemonApi.restartServer({
    serverId: context.serverId,
    timeout: 30000
  });
  if (!response.success) throw new Error(`Restart failed: ${response.error}`);
}
```

## Daemon API Contracts

### HTTP Endpoints Needed

All endpoints should require server authentication token.

```
POST /api/files/download
  {
    serverId: string,
    url: string,
    destPath: string,
    headers?: object,
    decompress?: boolean
  }

POST /api/files/write
  {
    serverId: string,
    path: string,
    content: string,
    append?: boolean
  }

POST /api/files/delete
  {
    serverId: string,
    path: string
  }

POST /api/servers/:serverId/command
  {
    command: string,
    timeout?: number
  }

POST /api/servers/:serverId/backups
  {
    name: string,
    description?: string
  }

POST /api/servers/:serverId/start
POST /api/servers/:serverId/stop
  {
    timeout?: number,
    force?: boolean
  }
POST /api/servers/:serverId/restart
  {
    timeout?: number
  }

GET /api/servers/:serverId/backups
GET /api/servers/:serverId/backups/:backupId
POST /api/servers/:serverId/backups/:backupId/restore
```

## Safety and Security

### Path Validation

```typescript
function validateServerPath(path: string, serverId: string): boolean {
  // 1. No directory traversal
  if (path.includes("..")) return false;

  // 2. Must be within server directory
  const serverDir = `/servers/${serverId}`;
  return path.startsWith(serverDir);
}
```

### URL Validation

```typescript
function validateDownloadUrl(url: string): boolean {
  // 1. Must be HTTPS (prevent MITM)
  if (!url.startsWith("https://")) return false;

  // 2. No localhost or private IPs (prevent SSRF)
  const disallowed = [
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "192.168.",
    "10.",
    "172.16.",
  ];

  for (const pattern of disallowed) {
    if (url.includes(pattern)) return false;
  }

  return true;
}
```

### Resource Limits

```typescript
// Maximum file size: 5GB
const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024;

// Maximum concurrent downloads: 3 per server
const MAX_CONCURRENT_DOWNLOADS = 3;

// Maximum backup size: 50GB
const MAX_BACKUP_SIZE = 50 * 1024 * 1024 * 1024;

// Command timeout: 5 minutes
const COMMAND_TIMEOUT = 5 * 60 * 1000;
```

## Testing Strategy

### Unit Tests

```rust
#[tokio::test]
async fn test_download_with_invalid_url() {
  let result = daemon.download_file(DownloadRequest {
    url: "http://localhost:8000/file.zip", // SSRF attempt
    ..
  }).await;

  assert!(result.is_err());
}

#[tokio::test]
async fn test_write_file_with_directory_traversal() {
  let result = daemon.write_file(WriteRequest {
    path: "../../etc/passwd", // Traversal attempt
    ..
  }).await;

  assert!(result.is_err());
}

#[tokio::test]
async fn test_command_timeout() {
  let start = Instant::now();
  let result = daemon.send_command(CommandRequest {
    command: "some-long-command",
    timeout: Some(1000), // 1 second
    ..
  }).await;

  assert!(result.is_err());
  assert!(start.elapsed() <= Duration::from_secs(2));
}
```

### Integration Tests

```rust
#[tokio::test]
async fn test_full_modpack_install_flow() {
  let server = setup_test_server().await;

  // 1. Create backup
  let backup = daemon.create_backup(&server.id).await.unwrap();

  // 2. Download modpack
  daemon.download_file(&DownloadRequest {
    url: "https://example.com/modpack.zip",
    dest_path: format!("{}/modpack.zip", server.path),
    decompress: true,
  }).await.unwrap();

  // 3. Send notification
  daemon.send_command(&CommandRequest {
    server_id: server.id.clone(),
    command: "say Modpack installed!".to_string(),
  }).await.unwrap();

  // 4. Restart server
  daemon.restart_server(&server.id).await.unwrap();

  // Verify files exist
  assert!(tokio::fs::try_exists(&format!("{}/mods", server.path)).await.unwrap());
}
```

## Progress Tracking

- [ ] Implement download-to-server operation
- [ ] Implement write-file operation
- [ ] Implement delete-file operation
- [ ] Implement send-command operation
- [ ] Implement backup creation
- [ ] Implement server control (start/stop/restart)
- [ ] Add path validation
- [ ] Add URL validation
- [ ] Add resource limits
- [ ] Add error recovery (resume downloads)
- [ ] Add audit logging
- [ ] Add unit tests
- [ ] Add integration tests
- [ ] Update CurseForge/Modrinth plugins
- [ ] Document for plugin developers

## Next Steps

1. **Choose implementation approach**:
   - Extend existing daemon HTTP endpoints
   - Add new plugin-specific service
   - Use existing file/backup services

2. **Implement core operations** in order of priority:
   - `send-command` (simplest)
   - `write-file`
   - `download-to-server`
   - `create-backup`
   - Server control operations

3. **Add safety layers**:
   - Path/URL validation
   - Resource limits
   - Error recovery

4. **Test thoroughly**:
   - Unit tests for each operation
   - Integration tests for plugin flows
   - Load testing for concurrent operations

5. **Update plugins**:
   - Enable CurseForge/Modrinth installers
   - Update example plugins
   - Add documentation

## Performance Considerations

- **Streaming downloads**: Don't load entire file in memory
- **Concurrent operations**: Limit to 3 per server
- **Backup compression**: Use zstd for fast compression
- **Path traversal checks**: Use canonicalize() for safety
- **Command queuing**: Queue server commands to prevent conflicts

## References

- [Plugin Action System](PHASE_1_IMPLEMENTATION.md)
- [Daemon Architecture](apps/daemon/src/router/mod.rs)
- [File Operations Handler](apps/daemon/src/router/handlers/files.rs)
- [Server Control Handler](apps/daemon/src/router/handlers/server.rs)

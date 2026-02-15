/**
 * Type definitions for the mock daemon.
 * Mirrors the Rust daemon's API types for full compatibility.
 */

/** Server power state */
type ServerState = "offline" | "starting" | "running" | "stopping" | "restarting";

/** Power action request */
type PowerAction = "start" | "stop" | "restart" | "kill";

/** System information response */
interface SystemInfo {
  version: string;
  architecture: string;
  cpu_count: number;
  kernel_version: string;
  os: string;
  server_count: number;
}

/** Hardware stats response */
interface HardwareStats {
  cpu: {
    cores: number;
    usage_percent: number;
    load_avg: { one: number; five: number; fifteen: number };
  };
  memory: {
    total: number;
    used: number;
    available: number;
    usage_percent: number;
  };
  disk: {
    total: number;
    used: number;
    available: number;
    usage_percent: number;
  };
  uptime: number;
  hostname: string;
  os: {
    name: string;
    version: string;
    arch: string;
  };
}

/** Build configuration for a server */
interface BuildConfiguration {
  memory_limit: number;
  swap: number;
  io_weight: number;
  cpu_limit: number;
  disk_space: number;
  oom_disabled: boolean;
}

/** Container configuration */
interface ContainerConfiguration {
  image: string;
  oom_disabled: boolean;
}

/** Port allocation */
interface Allocation {
  ip: string;
  port: number;
}

/** Allocation configuration */
interface AllocationConfiguration {
  default: Allocation;
  mappings: Record<string, number[]>;
}

/** Egg configuration */
interface EggConfiguration {
  id: string;
  file_denylist: string[];
}

/** Mount configuration */
interface MountConfiguration {
  source: string;
  target: string;
  read_only: boolean;
}

/** Create server request body */
interface CreateServerRequest {
  uuid: string;
  name: string;
  suspended?: boolean;
  invocation?: string;
  skip_egg_scripts?: boolean;
  build?: BuildConfiguration;
  container?: ContainerConfiguration;
  allocations?: AllocationConfiguration;
  egg?: EggConfiguration;
  mounts?: MountConfiguration[];
}

/** Server summary in list response */
interface ServerSummary {
  uuid: string;
  name: string;
  state: ServerState;
  is_installing: boolean;
  is_transferring: boolean;
  is_restoring: boolean;
  suspended: boolean;
}

/** Full server response */
interface ServerResponse extends ServerSummary {
  invocation: string;
  container: ContainerConfiguration;
}

/** File entry in directory listing */
interface FileInfo {
  name: string;
  size: number;
  is_directory: boolean;
  is_file: boolean;
  is_symlink: boolean;
  modified: number;
  created: number;
  mode: number;
  mime_type: string;
}

/** Write file request */
interface WriteFileRequest {
  file: string;
  content: string;
}

/** Create file/directory request */
interface CreateFileRequest {
  path: string;
  type: "file" | "directory";
  content?: string;
}

/** Rename file request */
interface RenameFileRequest {
  root?: string;
  files: Array<{ from: string; to: string }>;
}

/** Copy file request */
interface CopyFileRequest {
  location: string;
}

/** Delete files request */
interface DeleteFilesRequest {
  files: string[];
  root?: string;
}

/** Compress files request */
interface CompressFilesRequest {
  root: string;
  files: string[];
}

/** Decompress file request */
interface DecompressFileRequest {
  root: string;
  file: string;
}

/** Chmod request */
interface ChmodRequest {
  files: Array<{ file: string; mode: number }>;
  root?: string;
}

/** Pull file request */
interface PullFileRequest {
  url: string;
  directory?: string;
  file_name?: string;
  use_header?: boolean;
  foreground?: boolean;
}

/** Backup entry */
interface BackupEntry {
  uuid: string;
  size: number;
  created_at: number;
}

/** Create backup request */
interface CreateBackupRequest {
  uuid: string;
  ignore?: string[];
}

/** Restore backup request */
interface RestoreBackupRequest {
  backup_id: string;
}

/** Transfer initiation request */
interface InitiateTransferRequest {
  transfer_id: string;
  target_url: string;
  target_token: string;
}

/** Transfer status response */
interface TransferResponse {
  success: boolean;
  message: string;
  checksum?: string;
  size?: number;
}

/** Schedule definition */
interface Schedule {
  id: string;
  name: string;
  cron_expression: string;
  enabled: boolean;
  tasks: ScheduleTask[];
}

/** Schedule task */
interface ScheduleTask {
  action: string;
  payload?: unknown;
}

/** Plugin download request */
interface PluginDownloadRequest {
  url: string;
  dest_path: string;
  directory?: string;
  decompress?: boolean;
  headers?: Record<string, string>;
  max_size?: number;
}

/** Plugin write request */
interface PluginWriteRequest {
  path: string;
  content: string;
  append?: boolean;
  mode?: string;
}

/** Plugin delete request */
interface PluginDeleteRequest {
  path: string;
  recursive?: boolean;
}

/** Plugin server control request */
interface PluginServerControlRequest {
  action: "start" | "stop" | "restart";
  timeout?: number;
  force?: boolean;
}

/** Plugin command request */
interface PluginCommandRequest {
  command: string;
  timeout?: number;
}

/** Generic daemon response */
interface DaemonResponse {
  success: boolean;
  message?: string;
  data?: unknown;
  error?: string;
}

/** Power action request body */
interface PowerActionRequest {
  action: PowerAction;
  wait_for_lock?: boolean;
}

/** Send command request body */
interface SendCommandRequest {
  command: string;
}

/** Console line with timestamp */
interface ConsoleLine {
  line: string;
  timestamp: number;
}

/** WebSocket stats payload */
interface WsStats {
  memory_bytes: number;
  memory_limit_bytes: number;
  cpu_absolute: number;
  network: { rx_bytes: number; tx_bytes: number };
  uptime: number;
  disk_bytes: number;
  disk_limit_bytes: number;
}

/** WebSocket incoming message */
interface WsIncomingMessage {
  event: string;
  args: unknown[];
}

/** In-memory mock server representation */
interface MockServer {
  config: CreateServerRequest;
  state: ServerState;
  suspended: boolean;
  is_installing: boolean;
  is_transferring: boolean;
  is_restoring: boolean;
  console_buffer: ConsoleLine[];
  files: Map<string, MockFile>;
  backups: Map<string, BackupEntry>;
  schedules: Map<string, Schedule>;
  started_at?: number;
}

/** In-memory file node */
interface MockFile {
  name: string;
  content: string;
  is_directory: boolean;
  size: number;
  modified: number;
  created: number;
  mode: number;
}

export type {
  ServerState,
  PowerAction,
  SystemInfo,
  HardwareStats,
  BuildConfiguration,
  ContainerConfiguration,
  Allocation,
  AllocationConfiguration,
  EggConfiguration,
  MountConfiguration,
  CreateServerRequest,
  ServerSummary,
  ServerResponse,
  FileInfo,
  WriteFileRequest,
  CreateFileRequest,
  RenameFileRequest,
  CopyFileRequest,
  DeleteFilesRequest,
  CompressFilesRequest,
  DecompressFileRequest,
  ChmodRequest,
  PullFileRequest,
  BackupEntry,
  CreateBackupRequest,
  RestoreBackupRequest,
  InitiateTransferRequest,
  TransferResponse,
  Schedule,
  ScheduleTask,
  PluginDownloadRequest,
  PluginWriteRequest,
  PluginDeleteRequest,
  PluginServerControlRequest,
  PluginCommandRequest,
  DaemonResponse,
  PowerActionRequest,
  SendCommandRequest,
  ConsoleLine,
  WsStats,
  WsIncomingMessage,
  MockServer,
  MockFile,
};

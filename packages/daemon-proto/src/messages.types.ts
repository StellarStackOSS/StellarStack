import type {
  Blueprint,
  BlueprintLifecycle,
} from "@workspace/shared/blueprint.types"
import type {
  ServerLifecycleReason,
  ServerLifecycleState,
} from "@workspace/shared/events.types"

/**
 * Envelope wrapping every message sent over the worker↔daemon control WS.
 * `id` correlates a request with its eventual response/error; daemon-initiated
 * events have `id: null`.
 */
export type DaemonEnvelope<T extends DaemonMessage = DaemonMessage> = {
  id: string | null
  message: T
}

/**
 * Discriminated union of every message that can travel the worker↔daemon
 * control channel. Worker-originated messages typically expect a response;
 * daemon-originated messages are events (state changes, stats, install logs).
 */
export type DaemonMessage =
  | DaemonHelloMessage
  | DaemonAcknowledgeMessage
  | DaemonErrorMessage
  | CreateContainerMessage
  | RunInstallScriptMessage
  | StartServerMessage
  | StopServerMessage
  | KillServerMessage
  | DeleteServerMessage
  | ServerStateChangedMessage
  | ServerStatsMessage
  | InstallLogMessage
  | ConsoleLogMessage
  | CreateBackupMessage
  | RestoreBackupMessage
  | DeleteBackupMessage
  | UploadBackupS3Message

/**
 * Initial daemon→worker message containing identity + capabilities.
 */
export type DaemonHelloMessage = {
  type: "daemon.hello"
  nodeId: string
  daemonVersion: string
  protocolVersion: number
  capabilities: string[]
}

/**
 * Generic success acknowledgement for a request that has no specific reply.
 */
export type DaemonAcknowledgeMessage = {
  type: "ack"
}

/**
 * Generic error reply. `code` is a translation key the API can pass through
 * to clients verbatim.
 */
export type DaemonErrorMessage = {
  type: "error"
  code: string
  params?: Record<string, string | number | boolean>
}

/**
 * Worker → daemon: create the container for a server using the given image
 * and resource limits.
 */
export type CreateContainerMessage = {
  type: "server.create_container"
  serverId: string
  dockerImage: string
  memoryLimitMb: number
  cpuLimitPercent: number
  diskLimitMb: number
  environment: Record<string, string>
  portMappings: Array<{ ip: string; port: number; containerPort: number }>
  startupCommand: string
  stopSignal: string
  lifecycle: BlueprintLifecycle
}

/**
 * Worker → daemon: run a blueprint's install script in a one-shot container.
 */
export type RunInstallScriptMessage = {
  type: "server.run_install"
  serverId: string
  install: Blueprint["install"]
  environment: Record<string, string>
}

/**
 * Worker → daemon: start a previously-installed server.
 */
export type StartServerMessage = {
  type: "server.start"
  serverId: string
}

/**
 * Worker → daemon: send the configured stop signal and arm the stopping
 * lifecycle probes.
 */
export type StopServerMessage = {
  type: "server.stop"
  serverId: string
}

/**
 * Worker → daemon: SIGKILL the container immediately.
 */
export type KillServerMessage = {
  type: "server.kill"
  serverId: string
}

/**
 * Worker → daemon: delete container + persistent files for a server.
 */
export type DeleteServerMessage = {
  type: "server.delete"
  serverId: string
  deleteFiles: boolean
}

/**
 * Daemon → worker: lifecycle state transition occurred.
 */
export type ServerStateChangedMessage = {
  type: "server.state_changed"
  serverId: string
  from: ServerLifecycleState
  to: ServerLifecycleState
  reason: ServerLifecycleReason
  at: string
}

/**
 * Daemon → worker: resource-usage snapshot.
 */
export type ServerStatsMessage = {
  type: "server.stats"
  serverId: string
  memoryBytes: number
  memoryLimitBytes: number
  cpuFraction: number
  diskBytes: number
  networkRxBytes: number
  networkTxBytes: number
  at: string
}

/**
 * Daemon → worker: install-script log line.
 */
export type InstallLogMessage = {
  type: "server.install_log"
  serverId: string
  stream: "stdout" | "stderr"
  line: string
  at: string
}

/**
 * Daemon → worker: console log line (replayed history is bounded; live tail
 * is delivered in order).
 */
export type ConsoleLogMessage = {
  type: "server.console"
  serverId: string
  line: string
  at: string
}

/**
 * Worker → daemon: archive the server's bind-mount into a tar.gz at
 * `${dataDir}/backups/{serverId}/{name}.tar.gz`. Daemon replies with an
 * `ack` whose extra fields carry the on-disk path, byte count, and
 * sha256 of the archive contents.
 */
export type CreateBackupMessage = {
  type: "server.create_backup"
  serverId: string
  name: string
}

/**
 * Worker → daemon: restore a previously-archived backup over the
 * server's bind-mount. Container should be stopped first.
 */
export type RestoreBackupMessage = {
  type: "server.restore_backup"
  serverId: string
  name: string
}

/**
 * Worker → daemon: drop a backup's local archive (and optional S3
 * object). Idempotent.
 */
export type DeleteBackupMessage = {
  type: "server.delete_backup"
  serverId: string
  name: string
  s3?: {
    endpoint: string
    region: string
    bucket: string
    accessKeyId: string
    secretAccessKey: string
    forcePathStyle: boolean
    key: string
  }
}

/**
 * Worker → daemon: stream the local archive bytes to the configured
 * S3-compatible bucket. Daemon replies with an `ack` whose `key` field
 * carries the resulting object key.
 */
export type UploadBackupS3Message = {
  type: "server.upload_backup_s3"
  serverId: string
  name: string
  endpoint: string
  region: string
  bucket: string
  prefix: string
  accessKeyId: string
  secretAccessKey: string
  forcePathStyle: boolean
  sha256: string
}

/**
 * Pub/sub bridge envelope used to relay daemon traffic between the API
 * (which holds the WS) and worker processes (which dispatch jobs). The
 * API forwards `envelope` to the matching daemon's WS on the cmd channel
 * and rebroadcasts anything the daemon emits back on the resp channel.
 */
export type DaemonBridgeEnvelope = {
  nodeId: string
  envelope: DaemonEnvelope
}

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

/**
 * Lifecycle states a managed server can occupy.
 */
export type ServerLifecycleState =
  | "installing"
  | "installed_stopped"
  | "starting"
  | "running"
  | "stopping"
  | "stopped"
  | "crashed"

/**
 * Reason metadata for a state transition. `code` is a translation key in the
 * `servers.lifecycle.*` namespace; `params` are interpolation values.
 */
export type ServerLifecycleReason = {
  code: string
  params?: Record<string, string | number | boolean>
}

/**
 * Event published when a server's lifecycle state changes. Emitted by the
 * daemon, persisted by the worker, and fanned out to subscribed panel sessions.
 */
export type ServerStateChangedEvent = {
  type: "server.state.changed"
  serverId: string
  from: ServerLifecycleState
  to: ServerLifecycleState
  reason: ServerLifecycleReason
  at: string
}

/**
 * Periodic resource-usage snapshot pushed by the daemon while a server is
 * running. Memory in bytes, CPU as a fraction (0..N — 1.0 = one full core).
 */
export type ServerStatsEvent = {
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
 * Progress for a long-running job (install, backup, restore, transfer).
 */
export type JobProgressEvent = {
  type: "job.progress"
  jobId: string
  serverId?: string
  jobType: string
  percent: number
  message?: { code: string; params?: Record<string, string | number | boolean> }
  at: string
}

/**
 * Discriminated union of every event the panel WS may carry.
 */
export type PanelEvent =
  | ServerStateChangedEvent
  | ServerStatsEvent
  | JobProgressEvent

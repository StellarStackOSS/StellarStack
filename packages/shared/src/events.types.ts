/**
 * Lifecycle states a managed server can occupy. Four states, mirrored on
 * daemon and frontend. Install/restore are separate flags on the server
 * row, not lifecycle states.
 */
export type ServerLifecycleState =
  | "offline"
  | "starting"
  | "running"
  | "stopping"

/**
 * Reason metadata for a state transition. `code` is a translation key in
 * the `servers.lifecycle.*` namespace; `params` are interpolation values.
 */
export type ServerLifecycleReason = {
  code: string
  params?: Record<string, string | number | boolean>
}

/**
 * Stats payload pushed by the daemon as the `stats` event on the per-
 * server WebSocket. Wire field names are snake_case to match the
 * standard protocol the daemon emits.
 */
export type ServerStatsPayload = {
  memory_bytes: number
  memory_limit_bytes: number
  cpu_absolute: number
  network: { rx_bytes: number; tx_bytes: number }
  disk_bytes: number
  disk_read_bytes: number
  disk_write_bytes: number
  uptime_ms?: number
  state: ServerLifecycleState
}

/**
 * Per-server WebSocket envelope. Every frame the daemon sends or the
 * browser sends fits this shape; `event` is the discriminator.
 */
export type WsEnvelope<E extends string = string, A = unknown[]> = {
  event: E
  args: A
}

/**
 * Daemon → API HTTP status callback body.
 */
export type StateCallbackBody = {
  previousState: ServerLifecycleState
  newState: ServerLifecycleState
  reason?: ServerLifecycleReason
  at: string
}

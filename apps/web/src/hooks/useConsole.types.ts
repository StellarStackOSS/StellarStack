import type { ServerLifecycleState } from "@workspace/shared/events.types"

import type { StatsSample } from "@/hooks/useServerStats.types"

/** Severity inferred from the log line's bracket prefix (e.g. "[14:12:22 INFO]"). */
export type ConsoleLogLevel = "default" | "info" | "warn" | "error"

/**
 * Single console line as displayed in the terminal. `id` is a
 * monotonically-increasing counter so React's keying stays stable across
 * re-renders. `receivedAt` is the client-side epoch ms when the line arrived.
 */
export type ConsoleLine = {
  id: number
  stream: "stdout" | "stderr"
  /** Text with any container-embedded timestamp already stripped. */
  line: string
  /** Time string extracted from the log line (e.g. "13:37:00.123"), or null. */
  logTimestamp: string | null
  /** Severity level inferred from the log line prefix. */
  logLevel: ConsoleLogLevel
  historical: boolean
  receivedAt: number
}

/** Connection state of the console WebSocket subscriber. */
export type ConsoleConnectionState =
  | "idle"
  | "connecting"
  | "open"
  | "reconnecting"
  | "closed"

/** Power actions the browser can ask the daemon to perform. */
export type ConsolePowerAction = "start" | "stop" | "restart" | "kill"

/**
 * Result returned from `useConsole`. The hook owns the daemon WebSocket
 * for one server and surfaces every signal the UI needs (lifecycle
 * state, console output, periodic stats, command/power dispatch).
 */
export type UseConsoleResult = {
  state: ConsoleConnectionState
  status: ServerLifecycleState | null
  lines: ConsoleLine[]
  stats: { latest: StatsSample | null; history: StatsSample[] }
  /**
   * Most recent code from a daemon-emitted `{event:"daemon error"}`
   * frame, e.g. `"eula-required"`. Cleared on the next start. The
   * EulaModal subscribes to this to know when to surface itself.
   */
  daemonError: string | null
  /** Clear `daemonError` (used by modals after the user dismisses). */
  clearDaemonError: () => void
  /** Send a console command (writes `<line>\n` to the container stdin). */
  sendCommand: (line: string) => void
  /** Dispatch a power action over the same WS. */
  setState: (action: ConsolePowerAction) => void
}

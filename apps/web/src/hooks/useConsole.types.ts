/**
 * Single console line as displayed in the terminal. `id` is a
 * monotonically-increasing counter so React's keying stays stable across
 * re-renders. `receivedAt` is the client-side epoch ms when the line arrived.
 */
/** Severity inferred from the log line's bracket prefix (e.g. "[14:12:22 INFO]"). */
export type ConsoleLogLevel = "default" | "info" | "warn" | "error"

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

/**
 * Connection state of the console WebSocket subscriber.
 */
export type ConsoleConnectionState =
  | "idle"
  | "connecting"
  | "open"
  | "reconnecting"
  | "closed"

/**
 * Result returned from `useConsole`.
 */
export type UseConsoleResult = {
  state: ConsoleConnectionState
  lines: ConsoleLine[]
  send: (command: string) => void
}

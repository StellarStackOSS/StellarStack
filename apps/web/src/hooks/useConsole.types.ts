/**
 * Single console line as displayed in the terminal. `id` is a
 * monotonically-increasing counter so React's keying stays stable across
 * re-renders.
 */
export type ConsoleLine = {
  id: number
  stream: "stdout" | "stderr"
  line: string
  historical: boolean
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

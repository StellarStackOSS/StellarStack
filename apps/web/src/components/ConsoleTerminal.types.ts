import type {
  ConsoleConnectionState,
  ConsoleLine,
} from "@/hooks/useConsole.types"

/**
 * Props accepted by `ConsoleTerminal`.
 */
export type ConsoleTerminalProps = {
  state: ConsoleConnectionState
  lines: ConsoleLine[]
  onSend: (command: string) => void
  canWrite?: boolean
}

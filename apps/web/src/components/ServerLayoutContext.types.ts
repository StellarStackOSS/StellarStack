import type { ServerLifecycleState } from "@workspace/shared/events.types"

import type {
  ConsoleConnectionState,
  UseConsoleResult,
} from "@/hooks/useConsole.types"
import type { ServerDetailRow } from "@/hooks/useServers.types"

/**
 * Context value passed from `ServerLayout` to each per-tab page. The
 * layout owns the daemon WS subscription so child pages reuse it
 * (one socket per server tab) instead of opening fresh ones.
 */
export type ServerLayoutContextValue = {
  server: ServerDetailRow
  status: ServerLifecycleState
  /** Daemon WS connection state. Renamed from the previous `wsState`. */
  wsState: ConsoleConnectionState
  /** The full console hook result; child pages pull lines, stats, sendCommand etc. from here. */
  console: UseConsoleResult
}

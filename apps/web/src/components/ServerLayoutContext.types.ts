import type {
  PanelEvent,
  ServerLifecycleState,
} from "@workspace/shared/events.types"

import type { PanelEventConnectionState } from "@/hooks/usePanelEvents.types"
import type { ServerDetailRow } from "@/hooks/useServers.types"

/**
 * Context value passed from `ServerLayout` to each per-tab page. The
 * layout owns the panel-event subscription + live status hook so child
 * pages don't each re-subscribe.
 */
export type ServerLayoutContextValue = {
  server: ServerDetailRow
  status: ServerLifecycleState
  events: PanelEvent[]
  wsState: PanelEventConnectionState
  /** Whether the daemon on the server's node is currently connected to the API. */
  daemonConnected: boolean
}

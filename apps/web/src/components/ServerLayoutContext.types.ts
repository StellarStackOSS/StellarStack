import type {
  PanelEvent,
  ServerLifecycleState,
} from "@workspace/shared/events.types"

import type { PanelEventConnectionState } from "@/hooks/usePanelEvents.types"
import type { ServerListRow } from "@/hooks/useServers.types"

/**
 * Context value passed from `ServerLayout` to each per-tab page. The
 * layout owns the panel-event subscription + live status hook so child
 * pages don't each re-subscribe.
 */
export type ServerLayoutContextValue = {
  server: ServerListRow
  status: ServerLifecycleState
  events: PanelEvent[]
  wsState: PanelEventConnectionState
}

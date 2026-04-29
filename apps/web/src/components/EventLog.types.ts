import type { PanelEvent } from "@workspace/shared/events.types"

import type { PanelEventConnectionState } from "@/hooks/usePanelEvents.types"

/**
 * Props accepted by `EventLog`.
 */
export type EventLogProps = {
  state: PanelEventConnectionState
  events: PanelEvent[]
}

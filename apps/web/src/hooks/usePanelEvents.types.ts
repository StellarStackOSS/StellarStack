import type { PanelEvent } from "@workspace/shared/events.types"

/**
 * Connection state of the panel-event subscriber.
 */
export type PanelEventConnectionState =
  | "connecting"
  | "open"
  | "reconnecting"
  | "closed"

/**
 * Snapshot returned from `usePanelEvents`. `events` is an append-only,
 * capped buffer (most recent first); `state` reflects the underlying WS.
 */
export type UsePanelEventsResult = {
  state: PanelEventConnectionState
  events: PanelEvent[]
}

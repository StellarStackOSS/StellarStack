import { useEffect, useMemo } from "react"
import { useQueryClient } from "@tanstack/react-query"

import type {
  PanelEvent,
  ServerLifecycleState,
} from "@workspace/shared/events.types"

/**
 * Watch the panel-event stream for `server.state.changed` frames matching
 * `serverId` and:
 *   1. Surface the latest state via `liveStatus` (null until one arrives).
 *   2. Mutate the cached server query in place so child components that
 *      read from `useServer(id)` re-render with the new status without a
 *      round-trip.
 *   3. Invalidate the server query as a follow-up so any non-cached
 *      subscribers refetch.
 *
 * Replaces the ad-hoc memo we used inline on ServerDetailPage; consumed by
 * the layout so every per-tab page sees the same source of truth.
 */
export const useLiveServerStatus = (
  serverId: string,
  events: PanelEvent[]
): ServerLifecycleState | null => {
  const queryClient = useQueryClient()
  const liveStatus = useMemo<ServerLifecycleState | null>(() => {
    const match = events.findLast(
      (e) => e.type === "server.state.changed" && e.serverId === serverId
    )
    return match?.type === "server.state.changed" ? match.to : null
  }, [events, serverId])

  useEffect(() => {
    if (liveStatus === null) {
      return
    }
    const queryKey = ["servers", serverId] as const
    queryClient.setQueryData<{ server: { status: ServerLifecycleState } }>(
      queryKey,
      (existing) => {
        if (existing === undefined) {
          return existing
        }
        if (existing.server.status === liveStatus) {
          return existing
        }
        return { ...existing, server: { ...existing.server, status: liveStatus } }
      }
    )
    void queryClient.invalidateQueries({ queryKey: ["servers"] })
  }, [liveStatus, serverId, queryClient])

  return liveStatus
}

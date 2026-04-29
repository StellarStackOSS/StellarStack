import { useMemo } from "react"

import type { PanelEvent } from "@workspace/shared/events.types"

import type {
  StatsSample,
  UseServerStatsResult,
} from "@/hooks/useServerStats.types"

const MAX_SAMPLES = 60

/**
 * Derive a per-server stats view from the panel-event buffer. `events` is
 * the rolling buffer that `usePanelEvents` already maintains
 * (most-recent-first, capped at 50). We reverse-filter for `server.stats`
 * frames matching the requested server id, capping the result at 60
 * samples — sufficient for the 60s sparkline given Docker's 1Hz cadence.
 *
 * Pure derivation: no setState, no extra subscription, so the render path
 * stays React-19-clean (no cascading-render lint warnings).
 */
export const useServerStats = (
  serverId: string,
  events: PanelEvent[]
): UseServerStatsResult => {
  const history = useMemo<StatsSample[]>(() => {
    const out: StatsSample[] = []
    for (let i = events.length - 1; i >= 0; i -= 1) {
      const event = events[i]
      if (event === undefined) {
        continue
      }
      if (event.type !== "server.stats" || event.serverId !== serverId) {
        continue
      }
      out.push({
        receivedAt: Date.parse(event.at),
        memoryBytes: event.memoryBytes,
        memoryLimitBytes: event.memoryLimitBytes,
        cpuFraction: event.cpuFraction,
        networkRxBytes: event.networkRxBytes,
        networkTxBytes: event.networkTxBytes,
      })
    }
    return out.slice(-MAX_SAMPLES)
  }, [events, serverId])

  return {
    latest: history[history.length - 1] ?? null,
    history,
  }
}

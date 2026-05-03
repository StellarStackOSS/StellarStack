import { useConsole } from "@/hooks/useConsole"
import type { UseServerStatsResult } from "@/hooks/useServerStats.types"

/**
 * Per-server stats view. Sourced from the daemon WebSocket via
 * `useConsole`. The hook signature is kept so existing call sites
 * (`OverviewTab`, the LiveStatsCard) don't need to thread the WS
 * everywhere — they just keep calling `useServerStats(serverId, enabled)`
 * and get the same `{latest, history}` shape they relied on before.
 */
export const useServerStats = (
  serverId: string,
  enabled: boolean
): UseServerStatsResult => {
  const console = useConsole(serverId, enabled)
  return console.stats
}

import type {
  StatsSample,
  UseServerStatsResult,
} from "@/hooks/useServerStats.types"

/**
 * Props for `LiveStatsCard`.
 */
export type LiveStatsCardProps = {
  stats: UseServerStatsResult
}

/**
 * Re-export so consumers don't have to know about useServerStats.types
 * just to type a prop.
 */
export type { StatsSample }

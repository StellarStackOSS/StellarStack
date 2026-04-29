/**
 * Single normalised stats sample buffered for `useServerStats`.
 */
export type StatsSample = {
  /** Wall-clock receive time in ms (used for the rolling window). */
  receivedAt: number
  memoryBytes: number
  memoryLimitBytes: number
  cpuFraction: number
  networkRxBytes: number
  networkTxBytes: number
}

/**
 * Result returned by `useServerStats`. `latest` is the most recent sample
 * (null until one arrives); `history` is a 60s rolling buffer used by the
 * sparkline.
 */
export type UseServerStatsResult = {
  latest: StatsSample | null
  history: StatsSample[]
}

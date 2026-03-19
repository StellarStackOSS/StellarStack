/**
 * Analytics comparison data for trending.
 */
export interface AnalyticsComparison {
  /** Current period value */
  current: number;
  /** Previous period value */
  previous: number;
  /** Percentage change between periods */
  percentageChange: number;
  /** Direction of the trend */
  trend: "up" | "down" | "stable";
}

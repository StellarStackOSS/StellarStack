import type { LiveStatsCardProps } from "@/components/LiveStatsCard.types"

const formatBytes = (bytes: number): string => {
  if (bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`
}

/**
 * Build the SVG path for a value-over-time sparkline. Mapped into an
 * 80×24 viewBox so two sparklines fit alongside the headline numbers.
 */
const sparkPath = (values: number[]): string => {
  if (values.length < 2) return ""
  const max = Math.max(...values, 1)
  const stepX = 80 / Math.max(values.length - 1, 1)
  return values
    .map((v, i) => {
      const x = i * stepX
      const y = 24 - (v / max) * 24
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(" ")
}

/**
 * Render the headline live stats (memory used / limit, CPU fraction,
 * network rx/tx) plus 60s sparklines. Renders an idle placeholder when
 * the server isn't running and no samples have arrived yet.
 */
export const LiveStatsCard = ({ stats }: LiveStatsCardProps) => {
  const { latest, history } = stats
  const memValues = history.map((h) => h.memoryBytes)
  const cpuValues = history.map((h) => h.cpuFraction * 100)

  return (
    <section className="border-border bg-card text-card-foreground rounded-md border p-4">
      <h2 className="mb-3 text-sm font-medium">Live stats</h2>
      {latest === null ? (
        <p className="text-muted-foreground text-xs">
          Waiting for stats. Frames arrive once the server is running.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 text-xs">
          <Tile
            label="Memory"
            value={`${formatBytes(latest.memoryBytes)} / ${formatBytes(latest.memoryLimitBytes)}`}
            sparkline={sparkPath(memValues)}
          />
          <Tile
            label="CPU"
            value={`${(latest.cpuFraction * 100).toFixed(1)}%`}
            sparkline={sparkPath(cpuValues)}
          />
          <Tile
            label="Net rx"
            value={formatBytes(latest.networkRxBytes)}
            sparkline=""
          />
          <Tile
            label="Net tx"
            value={formatBytes(latest.networkTxBytes)}
            sparkline=""
          />
        </div>
      )}
    </section>
  )
}

const Tile = ({
  label,
  value,
  sparkline,
}: {
  label: string
  value: string
  sparkline: string
}) => (
  <div className="border-border flex items-center justify-between rounded border px-3 py-2">
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div className="font-mono">{value}</div>
    </div>
    {sparkline.length > 0 ? (
      <svg
        viewBox="0 0 80 24"
        width={80}
        height={24}
        className="text-chart-1"
        aria-hidden
      >
        <path
          d={sparkline}
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ) : null}
  </div>
)

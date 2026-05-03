import { Sparkline } from "@/components/grid/Sparkline"
import {
  StatCard,
  StatCardContent,
  StatCardFooter,
  StatCardHeader,
  StatCardTitle,
} from "@/components/grid/StatCard"
import type { StatsSample } from "@/hooks/useServerStats.types"

const usageColor = (pct: number): string => {
  if (pct >= 90) return "#ef4444"
  if (pct >= 70) return "#f59e0b"
  return "#818cf8"
}

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(0)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}

export const MemoryCard = ({
  latest,
  history,
}: {
  latest: StatsSample | null
  history: StatsSample[]
}) => {
  const pct =
    latest !== null && latest.memoryLimitBytes > 0
      ? Math.round((latest.memoryBytes / latest.memoryLimitBytes) * 100)
      : null
  const sparkData = history.map((s) =>
    s.memoryLimitBytes > 0 ? s.memoryBytes / s.memoryLimitBytes : 0
  )
  const color = usageColor(pct ?? 0)

  return (
    <StatCard>
      <StatCardHeader>
        <StatCardTitle>Memory</StatCardTitle>
        {pct !== null ? (
          <span className="font-mono text-[0.65rem] text-zinc-500">{pct}%</span>
        ) : null}
      </StatCardHeader>
      <StatCardContent className="justify-end gap-2">
        {pct !== null ? (
          <span
            className="font-mono text-3xl font-light leading-none"
            style={{ color }}
          >
            {pct}
            <span className="ml-0.5 text-base text-zinc-500">%</span>
          </span>
        ) : (
          <span className="font-mono text-3xl font-light leading-none text-zinc-700">
            —
          </span>
        )}
        <Sparkline
          data={sparkData}
          color={color}
          fillColor={`${color}26`}
          height={28}
          className="mt-auto"
        />
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct ?? 0}%`, backgroundColor: color }}
          />
        </div>
      </StatCardContent>
      {latest !== null ? (
        <StatCardFooter>
          <span>
            {formatBytes(latest.memoryBytes)}
            <span className="mx-1 text-zinc-700">/</span>
            {formatBytes(latest.memoryLimitBytes)}
          </span>
        </StatCardFooter>
      ) : null}
    </StatCard>
  )
}

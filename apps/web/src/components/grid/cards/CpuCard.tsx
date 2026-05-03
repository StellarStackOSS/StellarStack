import { Sparkline } from "@/components/grid/Sparkline"
import {
  StatCard,
  StatCardContent,
  StatCardHeader,
  StatCardTitle,
} from "@/components/grid/StatCard"
import type { StatsSample } from "@/hooks/useServerStats.types"

const usageColor = (pct: number): string => {
  if (pct >= 90) return "#ef4444"
  if (pct >= 70) return "#f59e0b"
  return "#22c55e"
}

export const CpuCard = ({
  latest,
  history,
}: {
  latest: StatsSample | null
  history: StatsSample[]
}) => {
  const pct = latest !== null ? Math.round(latest.cpuFraction * 100) : null
  const sparkData = history.map((s) => s.cpuFraction)
  const color = usageColor(pct ?? 0)

  return (
    <StatCard>
      <StatCardHeader>
        <StatCardTitle>CPU</StatCardTitle>
        {pct !== null ? (
          <span className="font-mono text-[0.65rem] text-zinc-500">
            {pct}%
          </span>
        ) : null}
      </StatCardHeader>
      <StatCardContent className="justify-end gap-2">
        {pct !== null ? (
          <span
            className="font-mono text-3xl font-light leading-none text-zinc-100"
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
        {/* usage bar */}
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct ?? 0}%`, backgroundColor: color }}
          />
        </div>
      </StatCardContent>
    </StatCard>
  )
}

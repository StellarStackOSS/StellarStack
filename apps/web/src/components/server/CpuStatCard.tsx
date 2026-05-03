import {
  Card,
  CardHeader,
  CardInner,
  CardTitle,
} from "@workspace/ui/components/card"
import { AnimatedNumber } from "@workspace/ui/components/animated-number"
import { Sparkline } from "@workspace/ui/components/sparkline"

import type { StatsSample } from "@/hooks/useServerStats.types"

const usageColor = (pct: number): string => {
  if (pct === 0) return "#71717a"
  if (pct > 75) return "#ef4444"
  if (pct > 50) return "#f59e0b"
  return "#22c55e"
}

export const CpuStatCard = ({
  latest,
  history,
}: {
  latest: StatsSample | null
  history: StatsSample[]
}) => {
  const pct = latest !== null ? latest.cpuFraction * 100 : null
  const color = usageColor(pct ?? 0)
  const data = history.map((s) => s.cpuFraction * 100)

  return (
    <Card>
      <CardHeader>
        <CardTitle>CPU</CardTitle>
      </CardHeader>
      <CardInner className="flex h-16 items-center">
        <div className="flex-1 px-3">
          <div className="font-mono text-lg font-medium leading-none text-zinc-100">
            {pct !== null ? (
              <AnimatedNumber value={pct} decimals={1} suffix="%" />
            ) : (
              "—"
            )}
          </div>
        </div>
        <div className="h-16 w-28 shrink-0">
          <Sparkline data={data} color={color} height={64} />
        </div>
      </CardInner>
    </Card>
  )
}

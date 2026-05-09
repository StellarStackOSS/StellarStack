import {
  Card,
  CardHeader,
  CardInner,
  CardTitle,
} from "@workspace/ui/components/card"
import { AnimatedNumber } from "@workspace/ui/components/animated-number"
import { Sparkline } from "@workspace/ui/components/sparkline"

import type { StatsSample } from "@/hooks/useServerStats.types"

const usageColor = (_pctOfLimit: number): string => "#ffffff"

export const CpuStatCard = ({
  latest,
  history,
  limitPercent,
}: {
  latest: StatsSample | null
  history: StatsSample[]
  /** Configured CPU cap, e.g. 200 for "two cores worth". */
  limitPercent: number
}) => {
  const pct = latest !== null ? latest.cpuFraction * 100 : null
  // Threshold is relative to the server's configured cap, not absolute —
  // a 100% reading on a 200% allocation is only half-utilised.
  const pctOfLimit =
    pct !== null && limitPercent > 0 ? (pct / limitPercent) * 100 : 0
  const color = usageColor(pctOfLimit)
  const data = history.map((s) => s.cpuFraction * 100)

  return (
    <Card>
      <CardHeader>
        <CardTitle>CPU</CardTitle>
      </CardHeader>
      <CardInner className="flex h-16 items-center">
        <div className="flex-1 px-3">
          <div className="font-mono text-lg font-medium leading-none text-foreground">
            {pct !== null ? (
              <AnimatedNumber value={pct} decimals={1} suffix="%" />
            ) : (
              "—"
            )}
          </div>
        </div>
        <div className="h-16 w-28 shrink-0">
          <Sparkline
            data={data}
            color={color}
            height={64}
            label="CPU"
            formatValue={(v) => `${v.toFixed(1)}%`}
          />
        </div>
      </CardInner>
    </Card>
  )
}

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
  return "#3b82f6"
}

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(0)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export const MemoryStatCard = ({
  latest,
  history,
}: {
  latest: StatsSample | null
  history: StatsSample[]
}) => {
  const pct =
    latest !== null && latest.memoryLimitBytes > 0
      ? (latest.memoryBytes / latest.memoryLimitBytes) * 100
      : null
  const color = usageColor(pct ?? 0)
  const data = history.map((s) =>
    s.memoryLimitBytes > 0 ? (s.memoryBytes / s.memoryLimitBytes) * 100 : 0
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Memory</CardTitle>
      </CardHeader>
      <CardInner className="flex h-16 items-center">
        <div className="flex-1 px-3">
          <div className="font-mono text-lg font-medium leading-snug text-zinc-100">
            {latest !== null ? formatBytes(latest.memoryBytes) : "—"}
          </div>
        </div>
        <div className="h-16 w-28 shrink-0">
          <Sparkline data={data} color={color} height={64} />
        </div>
      </CardInner>
    </Card>
  )
}

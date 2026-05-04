import {
  Card,
  CardHeader,
  CardInner,
  CardTitle,
} from "@workspace/ui/components/card"
import { DualSparkline } from "@workspace/ui/components/sparkline"

import type { StatsSample } from "@/hooks/useServerStats.types"

const formatSpeed = (bytesPerSec: number): string => {
  if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`
  return `${(bytesPerSec / 1024 / 1024).toFixed(2)} MB/s`
}

const computeSpeeds = (history: StatsSample[]): { rx: number; tx: number }[] => {
  const out: { rx: number; tx: number }[] = []
  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1]
    const curr = history[i]
    if (prev === undefined || curr === undefined) continue
    const dtMs = curr.receivedAt - prev.receivedAt
    if (dtMs <= 0) continue
    const dtSec = dtMs / 1000
    out.push({
      rx: Math.max(0, curr.networkRxBytes - prev.networkRxBytes) / dtSec,
      tx: Math.max(0, curr.networkTxBytes - prev.networkTxBytes) / dtSec,
    })
  }
  return out
}

const rxColor = "#22c55e"
const txColor = "#3b82f6"

export const NetworkStatCard = ({
  latest,
  history,
}: {
  latest: StatsSample | null
  history: StatsSample[]
}) => {
  const speeds = computeSpeeds(history)
  const lastSpeed = speeds[speeds.length - 1]
  const maxSpeed = Math.max(...speeds.flatMap((s) => [s.rx, s.tx]), 1)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Network</CardTitle>
      </CardHeader>
      <CardInner className="flex h-16 items-center">
        <div className="flex-1 px-3">
          <div className="font-mono text-lg font-medium leading-none text-zinc-100">
            {latest !== null && lastSpeed !== undefined
              ? `↓ ${formatSpeed(lastSpeed.rx)}`
              : "—"}
          </div>
        </div>
        <div className="h-16 w-28 shrink-0">
          <DualSparkline
            data1={speeds.map((s) => s.rx)}
            data2={speeds.map((s) => s.tx)}
            color1={rxColor}
            color2={txColor}
            height={64}
            minDomain={0}
            maxDomain={maxSpeed}
            label1="↓ Rx"
            label2="↑ Tx"
            formatValue={formatSpeed}
          />
        </div>
      </CardInner>
    </Card>
  )
}

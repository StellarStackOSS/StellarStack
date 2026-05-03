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

const computeSpeeds = (history: StatsSample[]): { read: number; write: number }[] => {
  const out: { read: number; write: number }[] = []
  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1]
    const curr = history[i]
    if (prev === undefined || curr === undefined) continue
    const dtMs = curr.receivedAt - prev.receivedAt
    if (dtMs <= 0) continue
    const dtSec = dtMs / 1000
    out.push({
      read: Math.max(0, curr.diskReadBytes - prev.diskReadBytes) / dtSec,
      write: Math.max(0, curr.diskWriteBytes - prev.diskWriteBytes) / dtSec,
    })
  }
  return out
}

const readColor = "#a855f7"
const writeColor = "#ec4899"

export const DiskStatCard = ({
  latest,
  history,
}: {
  latest: StatsSample | null
  history: StatsSample[]
}) => {
  const speeds = computeSpeeds(history)
  const lastSpeed = speeds[speeds.length - 1]
  const maxSpeed = Math.max(...speeds.flatMap((s) => [s.read, s.write]), 1)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Disk I/O</CardTitle>
      </CardHeader>
      <CardInner className="flex h-16 items-center">
        <div className="flex-1 px-3">
          <div className="font-mono text-lg font-medium leading-none text-zinc-100">
            {latest !== null && lastSpeed !== undefined
              ? `R ${formatSpeed(lastSpeed.read)}`
              : "—"}
          </div>
        </div>
        <div className="h-16 w-28 shrink-0">
          <DualSparkline
            data1={speeds.map((s) => s.read)}
            data2={speeds.map((s) => s.write)}
            color1={readColor}
            color2={writeColor}
            height={64}
            minDomain={0}
            maxDomain={maxSpeed}
          />
        </div>
      </CardInner>
    </Card>
  )
}

import { useEffect, useState } from "react"

import {
  Card,
  CardHeader,
  CardInner,
  CardTitle,
} from "@workspace/ui/components/card"
import { DualSparkline, Sparkline } from "@workspace/ui/components/sparkline"

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / 1024 / 1024).toFixed(0)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}
const formatSpeed = (bps: number): string => {
  if (bps < 1024) return `${bps.toFixed(0)} B/s`
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`
  return `${(bps / 1024 / 1024).toFixed(2)} MB/s`
}

const useSeries = (
  generator: (t: number) => number,
  length = 60,
  intervalMs = 800
) => {
  const [series, setSeries] = useState<number[]>(() =>
    Array.from({ length }, (_, i) => generator(i))
  )
  useEffect(() => {
    let t = length
    const id = window.setInterval(() => {
      setSeries((prev) => [...prev.slice(1), generator(t++)])
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [generator, length, intervalMs])
  return series
}

const MEMORY_LIMIT = 4 * 1024 * 1024 * 1024 // 4 GB

export const MemoryCardDemo = () => {
  const series = useSeries((t) => {
    const noise = Math.sin(t / 4) * 0.08 + Math.sin(t / 11) * 0.05
    return Math.min(MEMORY_LIMIT, (0.55 + noise) * MEMORY_LIMIT)
  })
  const latest = series[series.length - 1]!
  return (
    <Card>
      <CardHeader>
        <CardTitle>Memory</CardTitle>
      </CardHeader>
      <CardInner className="flex h-16 items-center">
        <div className="flex-1 px-3">
          <div className="font-mono text-lg font-medium leading-snug text-zinc-100">
            {formatBytes(latest)}
          </div>
        </div>
        <div className="h-16 w-28 shrink-0">
          <Sparkline
            data={series}
            color="#3b82f6"
            height={64}
            minDomain={0}
            maxDomain={MEMORY_LIMIT}
            label="Memory"
            formatValue={formatBytes}
          />
        </div>
      </CardInner>
    </Card>
  )
}

export const CpuCardDemo = () => {
  const series = useSeries((t) =>
    Math.max(0, Math.min(100, 35 + Math.sin(t / 6) * 18 + Math.sin(t / 14) * 8))
  )
  const latest = series[series.length - 1]!
  return (
    <Card>
      <CardHeader>
        <CardTitle>CPU</CardTitle>
      </CardHeader>
      <CardInner className="flex h-16 items-center">
        <div className="flex-1 px-3">
          <div className="font-mono text-lg font-medium leading-snug text-zinc-100">
            {latest.toFixed(1)}%
          </div>
        </div>
        <div className="h-16 w-28 shrink-0">
          <Sparkline
            data={series}
            color="#22c55e"
            height={64}
            label="CPU"
            formatValue={(v) => `${v.toFixed(1)}%`}
          />
        </div>
      </CardInner>
    </Card>
  )
}

export const NetworkCardDemo = () => {
  const rx = useSeries((t) => Math.max(0, 200_000 + Math.sin(t / 3) * 180_000))
  const tx = useSeries((t) => Math.max(0, 80_000 + Math.sin(t / 5) * 60_000))
  const latest = rx[rx.length - 1]!
  const max = Math.max(...rx, ...tx, 1)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Network</CardTitle>
      </CardHeader>
      <CardInner className="flex h-16 items-center">
        <div className="flex-1 px-3">
          <div className="font-mono text-lg font-medium leading-snug text-zinc-100">
            ↓ {formatSpeed(latest)}
          </div>
        </div>
        <div className="h-16 w-28 shrink-0">
          <DualSparkline
            data1={rx}
            data2={tx}
            color1="#3b82f6"
            color2="#a855f7"
            height={64}
            minDomain={0}
            maxDomain={max}
            label1="↓ Rx"
            label2="↑ Tx"
            formatValue={formatSpeed}
          />
        </div>
      </CardInner>
    </Card>
  )
}

export const DiskCardDemo = () => {
  const read = useSeries((t) => Math.max(0, 50_000 + Math.sin(t / 7) * 40_000))
  const write = useSeries((t) => Math.max(0, 120_000 + Math.sin(t / 4) * 90_000))
  const latest = read[read.length - 1]!
  const max = Math.max(...read, ...write, 1)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Disk I/O</CardTitle>
      </CardHeader>
      <CardInner className="flex h-16 items-center">
        <div className="flex-1 px-3">
          <div className="font-mono text-lg font-medium leading-snug text-zinc-100">
            R {formatSpeed(latest)}
          </div>
        </div>
        <div className="h-16 w-28 shrink-0">
          <DualSparkline
            data1={read}
            data2={write}
            color1="#a855f7"
            color2="#ec4899"
            height={64}
            minDomain={0}
            maxDomain={max}
            label1="Read"
            label2="Write"
            formatValue={formatSpeed}
          />
        </div>
      </CardInner>
    </Card>
  )
}

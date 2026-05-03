import { Sparkline } from "@/components/grid/Sparkline"
import {
  StatCard,
  StatCardContent,
  StatCardHeader,
  StatCardTitle,
} from "@/components/grid/StatCard"
import type { StatsSample } from "@/hooks/useServerStats.types"

const formatRate = (bytesPerSec: number): string => {
  if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`
  return `${(bytesPerSec / 1024 / 1024).toFixed(1)} MB/s`
}

const deriveRates = (history: StatsSample[]) => {
  const rx: number[] = []
  const tx: number[] = []
  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1]
    const curr = history[i]
    if (prev === undefined || curr === undefined) continue
    const dt = Math.max((curr.receivedAt - prev.receivedAt) / 1000, 0.1)
    rx.push(Math.max(0, (curr.networkRxBytes - prev.networkRxBytes) / dt))
    tx.push(Math.max(0, (curr.networkTxBytes - prev.networkTxBytes) / dt))
  }
  return { rx, tx }
}

export const NetworkCard = ({
  latest,
  history,
}: {
  latest: StatsSample | null
  history: StatsSample[]
}) => {
  const { rx, tx } = deriveRates(history)
  const latestRx = rx[rx.length - 1] ?? 0
  const latestTx = tx[tx.length - 1] ?? 0
  const maxRx = Math.max(...rx, 1)
  const maxTx = Math.max(...tx, 1)

  return (
    <StatCard>
      <StatCardHeader>
        <StatCardTitle>Network</StatCardTitle>
      </StatCardHeader>
      <StatCardContent className="justify-end gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[0.6rem] uppercase tracking-widest text-zinc-600">↓</span>
            <span className="font-mono text-sm text-zinc-300">
              {latest !== null ? formatRate(latestRx) : "—"}
            </span>
          </div>
          <Sparkline
            data={rx.map((v) => v / maxRx)}
            color="#34d399"
            fillColor="#34d39926"
            height={20}
          />
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[0.6rem] uppercase tracking-widest text-zinc-600">↑</span>
            <span className="font-mono text-sm text-zinc-300">
              {latest !== null ? formatRate(latestTx) : "—"}
            </span>
          </div>
          <Sparkline
            data={tx.map((v) => v / maxTx)}
            color="#818cf8"
            fillColor="#818cf826"
            height={20}
          />
        </div>
      </StatCardContent>
    </StatCard>
  )
}

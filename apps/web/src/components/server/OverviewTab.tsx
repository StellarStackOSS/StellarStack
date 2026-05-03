import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import {
  Card,
  CardHeader,
  CardInner,
  CardTitle,
} from "@workspace/ui/components/card"

import { ConsoleTerminal } from "@/components/ConsoleTerminal"
import { CpuStatCard } from "@/components/server/CpuStatCard"
import { DiskStatCard } from "@/components/server/DiskStatCard"
import { MemoryStatCard } from "@/components/server/MemoryStatCard"
import { NetworkStatCard } from "@/components/server/NetworkStatCard"
import { useServerAllocations } from "@/hooks/useServerAllocations"
import { useServerLayout } from "@/components/ServerLayoutContext"

const formatUptime = (ms: number): string => {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}d ${h % 24}h ${m % 60}m`
  if (h > 0) return `${h}h ${m % 60}s`
  if (m > 0) return `${m}m ${s % 60}s`
  return `${s}s`
}

export const OverviewTab = () => {
  const { t } = useTranslation()
  const { server, status, console } = useServerLayout()
  const allocations = useServerAllocations(server.id)

  const stats = console.stats
  const wsConnected = console.state === "open"

  const primaryAlloc = allocations.data?.allocations.find(
    (a) => a.id === allocations.data?.primaryAllocationId
  )
  const address =
    primaryAlloc !== undefined ? `${primaryAlloc.ip}:${primaryAlloc.port}` : "—"

  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (status !== "running") return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [status])

  const uptime = useMemo(() => {
    if (status !== "running") return null
    if (stats.latest?.startedAt !== undefined) {
      const parsed = Date.parse(stats.latest.startedAt)
      if (!isNaN(parsed)) return now - parsed
    }
    return null
  }, [status, stats.latest?.startedAt, now])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {!wsConnected ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {t("overview.node_unreachable")}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Server Name</CardTitle>
          </CardHeader>
          <CardInner className="flex min-h-16 items-center px-4 py-4">
            <span className="text-lg font-medium text-zinc-100">{server.name}</span>
          </CardInner>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Address</CardTitle>
          </CardHeader>
          <CardInner className="flex min-h-16 items-center px-4 py-4">
            <span className="font-mono text-lg font-medium text-zinc-100">
              {address}
            </span>
          </CardInner>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Uptime</CardTitle>
          </CardHeader>
          <CardInner className="flex min-h-16 items-center px-4 py-4">
            <span className="font-mono text-lg font-medium tabular-nums text-zinc-100">
              {uptime !== null ? formatUptime(uptime) : "—"}
            </span>
          </CardInner>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <CpuStatCard latest={stats.latest} history={stats.history} />
        <MemoryStatCard latest={stats.latest} history={stats.history} />
        <DiskStatCard latest={stats.latest} history={stats.history} />
        <NetworkStatCard latest={stats.latest} history={stats.history} />
      </div>

      <ConsoleTerminal
        state={console.state}
        lines={console.lines}
        onSend={console.sendCommand}
      />
    </div>
  )
}

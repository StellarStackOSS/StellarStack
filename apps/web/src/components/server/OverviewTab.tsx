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
import { useConsole } from "@/hooks/useConsole"
import { useServerAllocations } from "@/hooks/useServerAllocations"
import { useServerLayout } from "@/components/ServerLayoutContext"
import { useServerStats } from "@/hooks/useServerStats"

const formatUptime = (ms: number): string => {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}d ${h % 24}h ${m % 60}m`
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`
  if (m > 0) return `${m}m ${s % 60}s`
  return `${s}s`
}

export const OverviewTab = () => {
  const { t } = useTranslation()
  const { server, status, events, daemonConnected } = useServerLayout()
  const allocations = useServerAllocations(server.id)

  const isActive =
    status === "starting" || status === "running" || status === "stopping"

  const stats = useServerStats(server.id, isActive ? events : [])
  const consoleStream = useConsole(server.id, isActive)

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

  // Derive uptime from the container's StartedAt (reported by the daemon via
  // Docker inspect). Falls back to the last "running" state-change event time.
  const uptime = useMemo(() => {
    if (status !== "running") return null
    if (stats.latest?.startedAt !== undefined) {
      const t = Date.parse(stats.latest.startedAt)
      if (!isNaN(t)) return now - t
    }
    const event = events.findLast(
      (e) => e.type === "server.state.changed" && e.to === "running"
    )
    if (event?.type === "server.state.changed") return now - new Date(event.at).getTime()
    return null
  // now ticks every second so the memo re-runs and the counter updates
  }, [status, stats.latest?.startedAt, events, now])

  const installLines = useMemo(() => {
    if (status !== "installing") return []
    const installStartEvent = events.findLast(
      (e) => e.type === "server.state.changed" && e.to === "installing"
    )
    const filterFrom =
      installStartEvent?.type === "server.state.changed"
        ? new Date(installStartEvent.at).getTime()
        : 0
    return events
      .filter(
        (e) =>
          e.type === "server.install_log" &&
          new Date(e.at).getTime() >= filterFrom
      )
      .map((e, i) => ({
        id: -(i + 1),
        stream: e.stream,
        line: e.line,
        logTimestamp: null,
        logLevel: "default" as const,
        historical: false,
        receivedAt: new Date(e.at).getTime(),
      }))
  }, [events, status])

  const consoleLines = useMemo(
    () =>
      installLines.length > 0
        ? [...installLines, ...consoleStream.lines]
        : consoleStream.lines,
    [installLines, consoleStream.lines]
  )

  const crashReasonCode = useMemo(() => {
    if (status !== "crashed") return null
    const event = events.findLast(
      (e) => e.type === "server.state.changed" && e.to === "crashed"
    )
    return event?.type === "server.state.changed" ? event.reason.code : null
  }, [events, status])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {!daemonConnected ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {t("overview.node_unreachable")}
        </p>
      ) : null}

      {crashReasonCode !== null ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          <span className="font-semibold">
            {t("lifecycle.crashed", { ns: "common" })}:{" "}
          </span>
          {t(`lifecycle.crash_reason.${crashReasonCode}`, {
            ns: "common",
            defaultValue: t(
              "lifecycle.crash_reason.servers.lifecycle.crashed.container_exit",
              { ns: "common" }
            ),
          })}
        </div>
      ) : null}

      {/* Row 1: name · address · uptime */}
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

      {/* Row 2: resource usage */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <CpuStatCard latest={stats.latest} history={stats.history} />
        <MemoryStatCard latest={stats.latest} history={stats.history} />
        <DiskStatCard latest={stats.latest} history={stats.history} />
        <NetworkStatCard latest={stats.latest} history={stats.history} />
      </div>

      <ConsoleTerminal
        state={consoleStream.state}
        lines={consoleLines}
        onSend={consoleStream.send}
      />
    </div>
  )
}

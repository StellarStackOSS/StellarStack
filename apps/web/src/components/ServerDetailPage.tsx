import { useMemo, useState } from "react"
import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import { Button } from "@workspace/ui/components/button"

import { ApiFetchError } from "@/lib/ApiFetch"
import { translateApiError } from "@/lib/TranslateError"
import { ConsoleTerminal } from "@/components/ConsoleTerminal"
import { EventLog } from "@/components/EventLog"
import { FileManager } from "@/components/FileManager"
import { LiveStatsCard } from "@/components/LiveStatsCard"
import { useConsole } from "@/hooks/useConsole"
import { usePanelEvents } from "@/hooks/usePanelEvents"
import { useServerStats } from "@/hooks/useServerStats"
import { useServer } from "@/hooks/useServers"
import { useServerPower } from "@/hooks/useServerPower"
import { useSession } from "@/lib/AuthClient"

type PowerAction = "start" | "stop" | "restart" | "kill"

/**
 * Per-server detail page. Status is the latest of (DB row from
 * useServer, server.state.changed events from the panel WS, refresh on
 * focus). Power buttons enqueue server.power jobs; the console
 * terminal opens a direct WS to the daemon (bypassing the API on the
 * data path) using a JWT minted by /servers/:id/ws-credentials.
 */
export const ServerDetailPage = ({ id }: { id: string }) => {
  const { t } = useTranslation()
  const { data: session, isPending } = useSession()
  const enabled = !isPending && session !== null
  const serverQuery = useServer(id)
  const { state: wsState, events } = usePanelEvents(enabled)
  const consoleStream = useConsole(id, enabled)
  const stats = useServerStats(id, events)
  const power = useServerPower(id)

  const [powerError, setPowerError] = useState<string | null>(null)

  const filteredEvents = useMemo(
    () =>
      events.filter(
        (event) =>
          ("serverId" in event && event.serverId === id) ||
          (event.type === "job.progress" && event.serverId === id)
      ),
    [events, id]
  )

  const liveStatus = useMemo(() => {
    for (const event of events) {
      if (event.type === "server.state.changed" && event.serverId === id) {
        return event.to
      }
    }
    return null
  }, [events, id])

  if (serverQuery.isLoading) {
    return (
      <div className="bg-background text-foreground flex min-h-svh items-center justify-center text-sm">
        Loading…
      </div>
    )
  }

  if (serverQuery.data === undefined) {
    return (
      <div className="bg-background text-foreground flex min-h-svh items-center justify-center text-sm">
        Server not found.
      </div>
    )
  }

  const server = serverQuery.data.server
  const status = liveStatus ?? server.status

  const handlePower = async (action: PowerAction) => {
    setPowerError(null)
    try {
      await power.mutateAsync(action)
    } catch (err) {
      if (err instanceof ApiFetchError) {
        setPowerError(translateApiError(t, err.body.error))
      } else if (err instanceof Error) {
        setPowerError(err.message)
      }
    }
  }

  return (
    <div className="bg-background text-foreground flex min-h-svh flex-col">
      <header className="border-border flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="text-base font-semibold">{server.name}</h1>
          <p className="text-muted-foreground text-xs">
            {t(`lifecycle.${status}`, { ns: "common" })} · {server.dockerImage}
          </p>
        </div>
        <Link to="/dashboard">
          <Button variant="outline" size="sm">
            Dashboard
          </Button>
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-6">
        <section className="border-border bg-card text-card-foreground rounded-md border p-4">
          <header className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">Power</h2>
            <span className="text-muted-foreground text-xs">
              {t(`lifecycle.${status}`, { ns: "common" })}
            </span>
          </header>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => handlePower("start")}
              disabled={power.isPending}
            >
              Start
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handlePower("restart")}
              disabled={power.isPending}
            >
              Restart
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handlePower("stop")}
              disabled={power.isPending}
            >
              Stop
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handlePower("kill")}
              disabled={power.isPending}
            >
              Kill
            </Button>
          </div>
          {powerError !== null ? (
            <p className="text-destructive mt-2 text-xs" role="alert">
              {powerError}
            </p>
          ) : null}
        </section>
        <LiveStatsCard stats={stats} />
        <ConsoleTerminal
          state={consoleStream.state}
          lines={consoleStream.lines}
          onSend={consoleStream.send}
        />
        <FileManager serverId={id} />
        <section className="border-border bg-card text-card-foreground rounded-md border p-4">
          <h2 className="mb-2 text-sm font-medium">Resources</h2>
          <dl className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <dt className="text-muted-foreground">Memory</dt>
              <dd>{server.memoryLimitMb} MB</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">CPU</dt>
              <dd>{server.cpuLimitPercent}%</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Disk</dt>
              <dd>{server.diskLimitMb} MB</dd>
            </div>
          </dl>
        </section>
        <EventLog state={wsState} events={filteredEvents} />
      </main>
    </div>
  )
}

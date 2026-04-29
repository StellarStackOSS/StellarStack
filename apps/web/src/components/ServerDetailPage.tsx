import { useMemo } from "react"
import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import { Button } from "@workspace/ui/components/button"

import { useServer } from "@/hooks/useServers"
import { useSession } from "@/lib/AuthClient"
import { usePanelEvents } from "@/hooks/usePanelEvents"
import { EventLog } from "@/components/EventLog"

/**
 * Per-server detail page. Status is the latest of (DB row from
 * useServer, server.state.changed events from the panel WS, refresh on
 * focus). The event log shows install progress + lifecycle transitions
 * specific to this server.
 */
export const ServerDetailPage = ({ id }: { id: string }) => {
  const { t } = useTranslation()
  const { data: session, isPending } = useSession()
  const enabled = !isPending && session !== null
  const serverQuery = useServer(id)
  const { state: wsState, events } = usePanelEvents(enabled)

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

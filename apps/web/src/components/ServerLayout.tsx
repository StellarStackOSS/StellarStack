import { Outlet, useParams } from "@tanstack/react-router"

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"

import { ServerSidebar } from "@/components/ServerSidebar"
import { ServerLayoutContext } from "@/components/ServerLayoutContext"
import { useLiveServerStatus } from "@/hooks/useLiveServerStatus"
import { usePanelEvents } from "@/hooks/usePanelEvents"
import { useServer } from "@/hooks/useServers"
import { useSession } from "@/lib/AuthClient"

/**
 * Shell rendered for every `/servers/$id/*` route. Owns the sidebar, the
 * panel-event subscription, and the live status hook so per-tab pages get
 * a consistent view without each one re-subscribing. Children receive the
 * resolved server + filtered events + live status via React context.
 */
export const ServerLayout = () => {
  const { id } = useParams({ from: "/servers/$id" })
  const { data: session, isPending } = useSession()
  const enabled = !isPending && session !== null
  const { state: wsState, events } = usePanelEvents(enabled)
  const liveStatus = useLiveServerStatus(id, events)
  const serverQuery = useServer(id)

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

  const filteredEvents = events.filter(
    (event) =>
      ("serverId" in event && event.serverId === id) ||
      (event.type === "job.progress" && event.serverId === id)
  )

  return (
    <SidebarProvider>
      <ServerSidebar server={server} liveStatus={liveStatus} />
      <SidebarInset>
        <header className="border-border flex items-center gap-2 border-b px-4 py-2">
          <SidebarTrigger />
          <div className="text-muted-foreground text-xs">{status}</div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 p-6">
          <ServerLayoutContext.Provider
            value={{ server, status, events: filteredEvents, wsState }}
          >
            <Outlet />
          </ServerLayoutContext.Provider>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

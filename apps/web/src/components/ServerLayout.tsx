import type { CSSProperties } from "react"
import { Outlet, useParams } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

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
 *
 * Uses the shadcn pattern: `SidebarProvider` carries the `--sidebar-width`
 * + `--header-height` CSS variables, the floating Sidebar sits next to a
 * `SidebarInset`, and the inset hosts a SiteHeader-style top bar plus the
 * outlet for child route content.
 */
export const ServerLayout = () => {
  const { id } = useParams({ from: "/servers/$id" })
  const { t } = useTranslation()
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
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as CSSProperties
      }
    >
      <ServerSidebar server={server} liveStatus={liveStatus} />
      <SidebarInset>
        <header className="bg-background sticky top-0 z-10 flex h-(--header-height) items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium">{server.name}</span>
            <span className="text-muted-foreground text-xs">
              {t(`lifecycle.${status}`, { ns: "common" })}
            </span>
          </div>
        </header>
        <div className="flex flex-1 flex-col">
          <main className="@container/main mx-auto w-full max-w-5xl flex-1 p-6">
            <ServerLayoutContext.Provider
              value={{ server, status, events: filteredEvents, wsState }}
            >
              <Outlet />
            </ServerLayoutContext.Provider>
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

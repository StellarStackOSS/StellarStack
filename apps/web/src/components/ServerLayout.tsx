import type { CSSProperties } from "react"
import { useEffect, useState } from "react"
import { Link, Outlet, useLocation, useParams } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { HugeiconsIcon } from "@hugeicons/react"
import type { HugeiconsIconElement } from "@hugeicons/react"
import {
  Calendar03Icon,
  DashboardSquare02Icon,
  EthernetPortIcon,
  FolderLibraryIcon,
  HardDriveIcon,
  ComputerTerminal02Icon,
  ListViewIcon,
  Settings02Icon,
  UserMultipleIcon,
} from "@hugeicons/core-free-icons"

import { Button } from "@workspace/ui/components/button"
import { ButtonGroup } from "@workspace/ui/components/button-group"
import { Separator } from "@workspace/ui/components/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"

import type { ServerLifecycleState } from "@workspace/shared/events.types"

import { ConfirmDialog } from "@/components/ConfirmDialog"
import { ServerSidebar } from "@/components/ServerSidebar"
import { ServerLayoutContext } from "@/components/ServerLayoutContext"
import { ApiFetchError } from "@/lib/ApiFetch"
import { translateApiError } from "@/lib/TranslateError"
import { useLiveServerStatus } from "@/hooks/useLiveServerStatus"
import { usePanelEvents } from "@/hooks/usePanelEvents"
import { useServer } from "@/hooks/useServers"
import { useServerPower } from "@/hooks/useServerPower"
import { useSession } from "@/lib/AuthClient"

type PowerAction = "start" | "stop" | "restart" | "kill"

const statusTextColor: Record<ServerLifecycleState, string> = {
  installing: "text-blue-400",
  installed_stopped: "text-zinc-500",
  starting: "text-amber-400",
  running: "text-emerald-400",
  stopping: "text-amber-400",
  stopped: "text-zinc-500",
  crashed: "text-destructive",
  restoring_backup: "text-amber-400",
}

type RouteEntry = { title: string; icon: HugeiconsIconElement }

const routeMap: Record<string, RouteEntry> = {
  "": { title: "Overview", icon: DashboardSquare02Icon },
  "/": { title: "Overview", icon: DashboardSquare02Icon },
  "/files": { title: "Files", icon: FolderLibraryIcon },
  "/backups": { title: "Backups", icon: HardDriveIcon },
  "/schedules": { title: "Schedules", icon: Calendar03Icon },
  "/users": { title: "Users", icon: UserMultipleIcon },
  "/network": { title: "Network", icon: EthernetPortIcon },
  "/startup": { title: "Startup", icon: ComputerTerminal02Icon },
  "/activity": { title: "Activity", icon: ListViewIcon },
  "/settings": { title: "Settings", icon: Settings02Icon },
}

/**
 * Shell rendered for every `/servers/$id/*` route. Owns the sidebar, the
 * panel-event subscription, live status, and the power action controls in the
 * header so they persist across every tab. Children receive the resolved
 * server + filtered events + live status via React context.
 */
export const ServerLayout = () => {
  const { id } = useParams({ from: "/servers/$id" })
  const { t } = useTranslation()
  const location = useLocation()
  const { data: session, isPending } = useSession()
  const enabled = !isPending && session !== null
  const { state: wsState, events } = usePanelEvents(enabled)
  const liveStatus = useLiveServerStatus(id, events)
  const serverQuery = useServer(id)
  const power = useServerPower(id)

  const [powerError, setPowerError] = useState<string | null>(null)
  const [killConfirmOpen, setKillConfirmOpen] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<ServerLifecycleState | null>(null)

  // Clear the optimistic status once the daemon confirms the transition via WS.
  useEffect(() => {
    if (liveStatus !== null) setPendingStatus(null)
  }, [liveStatus])

  const handlePower = async (action: PowerAction) => {
    setPowerError(null)
    if (action === "stop" || action === "restart") setPendingStatus("stopping")
    else if (action === "start") setPendingStatus("starting")
    else if (action === "kill") setPendingStatus("stopping")
    try {
      await power.mutateAsync(action)
    } catch (err) {
      setPendingStatus(null)
      if (err instanceof ApiFetchError) {
        setPowerError(translateApiError(t, err.body.error))
      } else {
        setPowerError(t("internal.unexpected", { ns: "errors" }))
      }
    }
  }

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
  const status = pendingStatus ?? liveStatus ?? server.status

  const basePath = `/servers/${id}`
  const sub = location.pathname.startsWith(basePath)
    ? location.pathname.slice(basePath.length)
    : ""
  const currentRoute = routeMap[sub] ?? routeMap[""]

  const filteredEvents = events.filter(
    (event) =>
      ("serverId" in event && event.serverId === id) ||
      (event.type === "job.progress" && event.serverId === id)
  )

  const daemonConnected = (() => {
    const match = events.findLast(
      (e) => e.type === "node.daemon.status" && e.nodeId === server.nodeId
    )
    return match?.type === "node.daemon.status" ? match.connected : true
  })()

  const canStart =
    status === "stopped" || status === "crashed" || status === "installed_stopped"
  const canStop = status === "running" || status === "starting"
  const canKill = status === "running" || status === "starting" || status === "stopping"
  const canRestart = status === "running"

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 60)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as CSSProperties
      }
      className="h-svh"
    >
      <ServerSidebar server={server} liveStatus={liveStatus} />
      <SidebarInset className="overflow-hidden border border-white/10">
        <header className="bg-background sticky top-0 z-10 flex h-(--header-height) shrink-0 items-center gap-2.5 border-b border-white/5 px-4">
          <SidebarTrigger className="-ml-1 text-zinc-500 hover:text-zinc-200" />
          <Separator orientation="vertical" className="mx-1 h-4" />
          <HugeiconsIcon
            icon={currentRoute.icon}
            className="size-4 shrink-0 text-zinc-500"
          />
          <span className="text-sm font-medium text-zinc-200">
            {currentRoute.title}
          </span>

          <div className="ml-auto flex items-center gap-3">
            <span
              className={`text-xs font-medium uppercase tracking-wider ${statusTextColor[status] ?? "text-zinc-500"}`}
            >
              {t(`lifecycle.${status}`, { ns: "common" })}
            </span>

            <Separator orientation="vertical" className="mx-1 h-4" />

            {powerError !== null && (
              <span className="text-destructive text-xs">{powerError}</span>
            )}
            {!daemonConnected && (
              <span className="text-destructive text-xs">
                {t("server_layout.daemon_offline")}
              </span>
            )}

            <ButtonGroup>
              <Button
                size="sm"
                variant="default"
                disabled={!daemonConnected || power.isPending || !canStart}
                onClick={() => void handlePower("start")}
              >
                {t("actions.start")}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={!daemonConnected || power.isPending || !canRestart}
                onClick={() => void handlePower("restart")}
              >
                {t("actions.restart")}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={!daemonConnected || power.isPending || !canStop}
                onClick={() => void handlePower("stop")}
              >
                {t("actions.stop")}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={!daemonConnected || power.isPending || !canKill}
                onClick={() => setKillConfirmOpen(true)}
              >
                {t("actions.kill")}
              </Button>
            </ButtonGroup>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col">
          <main className="@container/main flex min-h-0 w-full flex-1 flex-col p-6">
            <ServerLayoutContext.Provider
              value={{ server, status, events: filteredEvents, wsState, daemonConnected }}
            >
              <Outlet />
            </ServerLayoutContext.Provider>
          </main>
        </div>
      </SidebarInset>

      <ConfirmDialog
        open={killConfirmOpen}
        onOpenChange={setKillConfirmOpen}
        title={t("actions.kill_confirm_title")}
        description={t("actions.kill_confirm_description")}
        confirmLabel={t("actions.kill")}
        variant="destructive"
        onConfirm={() => handlePower("kill")}
      />
    </SidebarProvider>
  )
}

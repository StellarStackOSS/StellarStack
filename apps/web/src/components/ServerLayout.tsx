import type { CSSProperties } from "react"
import { useEffect, useState } from "react"
import { Outlet, useLocation, useParams } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import { Icon, type IconName } from "@/components/Icon"
import { PageTransition } from "@/components/PageTransition"

import { Button } from "@workspace/ui/components/button"
import { ButtonGroup } from "@workspace/ui/components/button-group"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Separator } from "@workspace/ui/components/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"

import type { ServerLifecycleState } from "@workspace/shared/events.types"

import { ConfirmDialog } from "@/components/ConfirmDialog"
import { InstallOverlay } from "@/components/InstallOverlay"
import { ServerStatusBadge } from "@/components/ServerStatusBadge"
import { AppSidebar } from "@/components/AppSidebar"
import type { NavItem } from "@/components/NavMain.types"
import { ServerLayoutContext } from "@/components/ServerLayoutContext"
import { EulaModal } from "@/components/server/EulaModal"
import { useConsole } from "@/hooks/useConsole"
import type { ConsolePowerAction } from "@/hooks/useConsole.types"
import { useServer } from "@/hooks/useServers"
import { useSession } from "@/lib/AuthClient"

const statusTextColor: Record<ServerLifecycleState, string> = {
  offline: "text-zinc-500",
  starting: "text-amber-400",
  running: "text-emerald-400",
  stopping: "text-amber-400",
}

type RouteEntry = { title: string; icon: IconName }

const routeMap: Record<string, RouteEntry> = {
  "": { title: "Overview", icon: "grid-layout" },
  "/": { title: "Overview", icon: "grid-layout" },
  "/files": { title: "Files", icon: "folder-library" },
  "/backups": { title: "Backups", icon: "hard-drive" },
  "/schedules": { title: "Schedules", icon: "calendar-plus" },
  "/instances": { title: "Instances", icon: "clone-dashed-3" },
  "/users": { title: "Users", icon: "user-multiple" },
  "/network": { title: "Network", icon: "ethernet" },
  "/databases": { title: "Databases", icon: "hard-drive" },
  "/startup": { title: "Startup", icon: "square-terminal" },
  "/activity": { title: "Activity", icon: "note-3" },
  "/crashes": { title: "Crashes", icon: "triangle-warning" },
  "/settings": { title: "Settings", icon: "settings" },
}

/**
 * Shell rendered for every `/servers/$id/*` route. Owns the daemon
 * WebSocket subscription via `useConsole` and exposes it (status,
 * lines, stats, power dispatch) to child pages through context. Power
 * buttons send `{event:"set state",…}` over that same socket — no REST
 * roundtrip, mirroring the upstream daemon's panel UX.
 */
export const ServerLayout = () => {
  const { id } = useParams({ from: "/servers/$id" })
  const { t } = useTranslation()
  const location = useLocation()
  const { data: session, isPending } = useSession()
  const enabled = !isPending && session !== null
  const consoleHook = useConsole(id, enabled)
  const serverQuery = useServer(id)

  const [optimistic, setOptimistic] = useState<ServerLifecycleState | null>(null)
  const [killConfirmOpen, setKillConfirmOpen] = useState(false)

  // The daemon's first `status` frame supersedes our optimistic guess.
  useEffect(() => {
    if (consoleHook.status !== null) setOptimistic(null)
  }, [consoleHook.status])

  const handlePower = (action: ConsolePowerAction) => {
    if (action === "stop" || action === "kill") setOptimistic("stopping")
    else if (action === "restart") setOptimistic("stopping")
    else if (action === "start") setOptimistic("starting")
    consoleHook.setState(action)
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
  const status: ServerLifecycleState =
    optimistic ?? consoleHook.status ?? server.status

  const basePath = `/servers/${id}`
  const sub = location.pathname.startsWith(basePath)
    ? location.pathname.slice(basePath.length)
    : ""
  const currentRoute = routeMap[sub] ?? routeMap[""]

  const navSections = [
    {
      label: t("sidebar.section.overview", { defaultValue: "Overview" }),
      items: [
        { title: t("sidebar.overview"), icon: "grid-layout",
          to: "/servers/$id", params: { id: server.id },
          isActive: sub === "" || sub === "/" },
        { title: t("sidebar.activity"), icon: "note-3",
          to: "/servers/$id/activity", params: { id: server.id },
          isActive: sub === "/activity" },
        { title: t("sidebar.crashes", { defaultValue: "Crashes" }), icon: "triangle-warning",
          to: "/servers/$id/crashes", params: { id: server.id },
          isActive: sub === "/crashes" },
      ] as NavItem[],
    },
    {
      label: t("sidebar.section.management", { defaultValue: "Management" }),
      items: [
        { title: t("sidebar.files"), icon: "folder-library",
          to: "/servers/$id/files", params: { id: server.id },
          isActive: sub === "/files" },
        { title: t("sidebar.backups"), icon: "hard-drive",
          to: "/servers/$id/backups", params: { id: server.id },
          isActive: sub === "/backups" },
        { title: t("sidebar.schedules"), icon: "calendar-plus",
          to: "/servers/$id/schedules", params: { id: server.id },
          isActive: sub === "/schedules" },
        { title: t("sidebar.instances"), icon: "clone-dashed-3",
          to: "/servers/$id/instances", params: { id: server.id },
          isActive: sub === "/instances" },
      ] as NavItem[],
    },
    {
      label: t("sidebar.section.config", { defaultValue: "Configuration" }),
      items: [
        { title: t("sidebar.startup"), icon: "square-terminal",
          to: "/servers/$id/startup", params: { id: server.id },
          isActive: sub === "/startup" },
        { title: t("sidebar.network"), icon: "ethernet",
          to: "/servers/$id/network", params: { id: server.id },
          isActive: sub === "/network" },
        { title: t("sidebar.databases", { defaultValue: "Databases" }),
          icon: "hard-drive",
          to: "/servers/$id/databases", params: { id: server.id },
          isActive: sub === "/databases" },
        { title: t("sidebar.users"), icon: "user-multiple",
          to: "/servers/$id/users", params: { id: server.id },
          isActive: sub === "/users" },
        { title: t("sidebar.settings"), icon: "settings",
          to: "/servers/$id/settings", params: { id: server.id },
          isActive: sub === "/settings" },
      ] as NavItem[],
    },
    ...(session?.user?.isAdmin === true
      ? [{
          label: t("sidebar.section.admin", { defaultValue: "Admin" }),
          items: [
            {
              title: t("sidebar.admin_view", { defaultValue: "View as admin" }),
              icon: "shield-user",
              to: "/admin/servers/$id",
              params: { id: server.id },
              search: { tab: "overview" },
              isActive: false,
            },
          ] as NavItem[],
        }]
      : []),
  ]
  const wsConnected = consoleHook.state === "open"
  const canStart = status === "offline"
  const canStop = status === "running" || status === "starting"
  const canKill = status === "running" || status === "starting" || status === "stopping"
  const canRestart = status === "running"
  const powerBusy = optimistic !== null

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
      <AppSidebar
        variant="inset"
        brandLabel={server.name}
        brandSecondary={server.nodeName ?? undefined}
        brandHref="/dashboard"
        nav={navSections}
      />
      <SidebarInset className="overflow-hidden border border-border">
        <header className="bg-background sticky top-0 z-10 flex h-(--header-height) shrink-0 items-center gap-2.5 border-b border-border px-4">
          <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
          <Separator orientation="vertical" className="mx-1 hidden h-4 sm:block" />
          <Icon
            name={currentRoute.icon}
            className="size-4 shrink-0 text-muted-foreground"
          />
          <span className="hidden text-sm font-medium text-foreground sm:inline">
            {currentRoute.title}
          </span>

          <div className="ml-auto flex items-center gap-3">
            <ServerStatusBadge status={status} />

            <Separator orientation="vertical" className="mx-1 hidden h-4 md:block" />

            {!wsConnected && (
              <span className="text-destructive hidden text-xs md:inline">
                {t("server_layout.daemon_offline")}
              </span>
            )}

            <ButtonGroup className="hidden md:flex">
              <Button
                size="sm"
                variant="default"
                disabled={!wsConnected || powerBusy || !canStart}
                onClick={() => handlePower("start")}
                className="bg-white text-zinc-900 hover:bg-zinc-200 disabled:bg-white"
              >
                {t("actions.start")}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={!wsConnected || powerBusy || !canRestart}
                onClick={() => handlePower("restart")}
              >
                {t("actions.restart")}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={!wsConnected || powerBusy || !canStop}
                onClick={() => handlePower("stop")}
              >
                {t("actions.stop")}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={!wsConnected || powerBusy || !canKill}
                onClick={() => setKillConfirmOpen(true)}
              >
                {t("actions.kill")}
              </Button>
            </ButtonGroup>

            <div className="flex items-center gap-2 md:hidden">
              <Button
                size="sm"
                variant="default"
                disabled={!wsConnected || powerBusy || !canStart}
                onClick={() => handlePower("start")}
                className="bg-white text-zinc-900 hover:bg-zinc-200 disabled:bg-white"
              >
                {t("actions.start")}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost" className="size-8 p-0">
                    <Icon name="more-horizontal" className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    disabled={!wsConnected || powerBusy || !canRestart}
                    onClick={() => handlePower("restart")}
                  >
                    {t("actions.restart")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!wsConnected || powerBusy || !canStop}
                    onClick={() => handlePower("stop")}
                  >
                    {t("actions.stop")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    disabled={!wsConnected || powerBusy || !canKill}
                    onClick={() => setKillConfirmOpen(true)}
                  >
                    {t("actions.kill")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <div className="relative flex min-h-0 flex-1 flex-col">
          <main className="@container/main flex min-h-0 w-full flex-1 flex-col overflow-y-auto p-4 md:p-6">
            <ServerLayoutContext.Provider
              value={{
                server,
                status,
                wsState: consoleHook.state,
                console: consoleHook,
              }}
            >
              <PageTransition key={location.pathname}>
                <Outlet />
              </PageTransition>
              <EulaModal />
            </ServerLayoutContext.Provider>
          </main>
          {server.installState !== "succeeded" ? (
            <InstallOverlay
              serverId={server.id}
              installState={server.installState}
            />
          ) : null}
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

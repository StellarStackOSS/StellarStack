import type { CSSProperties } from "react"
import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
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
import { ConsoleAiPanel } from "@/components/ConsoleAiPanel"
import { ConsoleAiSheet } from "@/components/ConsoleAiSheet"
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
  const [aiOpen, setAiOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window === "undefined"
      ? true
      : window.matchMedia("(min-width: 768px)").matches
  )
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 768px)")
    const update = () => setIsDesktop(mql.matches)
    mql.addEventListener("change", update)
    return () => mql.removeEventListener("change", update)
  }, [])

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
      <ServerLayoutContext.Provider
        value={{
          server,
          status,
          wsState: consoleHook.state,
          console: consoleHook,
          aiOpen,
          setAiOpen,
        }}
      >
      <AppSidebar
        variant="inset"
        brandLabel={server.name}
        brandSecondary={server.nodeName ?? undefined}
        brandHref="/dashboard"
        nav={navSections}
      />
      <SidebarInset className="overflow-hidden border border-border">
        <header className="bg-background sticky top-0 z-10 flex h-(--header-height) shrink-0 items-center gap-2.5 px-4 md:px-6">
          <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
          <span className="hidden text-sm font-normal text-muted-foreground sm:inline">
            {currentRoute.title}
          </span>

          <div className="ml-auto flex items-center gap-2">
            <ServerStatusBadge status={status} />

            <Separator orientation="vertical" className="hidden h-4 md:block" />

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

        <main className="@container/main flex min-h-0 w-full flex-1 flex-col overflow-y-auto px-4 pt-1 pb-4 md:px-6 md:pb-6">
          <PageTransition key={location.pathname}>
            <Outlet />
          </PageTransition>
          <EulaModal />
        </main>
        {server.installState !== "succeeded" ? (
          <InstallOverlay
            serverId={server.id}
            installState={server.installState}
          />
        ) : null}
      </SidebarInset>

      <AnimatePresence initial={false}>
        {isDesktop && aiOpen && (
          <motion.aside
            key="ai-panel"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 388, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="shrink-0 overflow-hidden"
          >
            {/* Mirrors SidebarInset's surface treatment so the AI panel
                reads as a twin of the main inset: rounded card, same
                bg. The 8px gap on the left comes from the inset's
                mr-2; the right edge sits flush against the viewport
                like the sidebar does on the left. */}
            <div className="bg-background border-border h-full w-[380px] overflow-hidden rounded-xl border shadow-sm md:my-2 md:mr-2">
              <ConsoleAiPanel
                serverId={server.id}
                lines={consoleHook.lines}
                onClose={() => setAiOpen(false)}
              />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {!isDesktop && (
        <ConsoleAiSheet
          open={aiOpen}
          onOpenChange={setAiOpen}
          serverId={server.id}
          lines={consoleHook.lines}
        />
      )}
      </ServerLayoutContext.Provider>

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

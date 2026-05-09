import type { CSSProperties } from "react"
import { Outlet, useLocation } from "@tanstack/react-router"

import { Separator } from "@workspace/ui/components/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"

import { AppSidebar } from "@/components/AppSidebar"
import { Icon, type IconName } from "@/components/Icon"
import type { NavItem } from "@/components/NavMain.types"
import { PageTransition } from "@/components/PageTransition"

type RouteEntry = { title: string; icon: IconName }

const routeMap: Record<string, RouteEntry> = {
  "/dashboard": { title: "Servers", icon: "server-stack" },
  "/account": { title: "Account", icon: "user-circle" },
  "/account/notifications": { title: "Notifications", icon: "bell" },
  "/account/connections": { title: "Connections", icon: "connections" },
  "/servers/new": { title: "New server", icon: "add" },
}

const resolveRoute = (path: string): RouteEntry =>
  routeMap[path] ?? { title: "StellarStack", icon: "dashboard" }

const isAccountSection = (path: string): boolean => path.startsWith("/account")

export const UserAreaLayout = () => {
  const location = useLocation()

  const accountItems: NavItem[] = [
    {
      title: "Account",
      icon: "user-circle",
      to: "/account",
      isActive: location.pathname === "/account",
    },
    {
      title: "Notifications",
      icon: "bell",
      to: "/account/notifications",
      isActive: location.pathname === "/account/notifications",
    },
    {
      title: "Connections",
      icon: "connections",
      to: "/account/connections",
      isActive: location.pathname === "/account/connections",
    },
  ]

  const dashboardItems: NavItem[] = [
    {
      title: "Servers",
      icon: "server-stack",
      to: "/dashboard",
      isActive: location.pathname === "/dashboard",
    },
  ]

  const items = isAccountSection(location.pathname) ? accountItems : dashboardItems
  const current = resolveRoute(location.pathname)

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
      <AppSidebar variant="inset" brandLabel="StellarStack" nav={{ items }} />
      <SidebarInset className="overflow-hidden border border-border">
        <header className="bg-background sticky top-0 z-10 flex h-(--header-height) shrink-0 items-center gap-2.5 border-b border-border px-4">
          <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
          <Separator orientation="vertical" className="mx-1 hidden h-4 sm:block" />
          <Icon name={current.icon} className="size-4 shrink-0 text-muted-foreground" />
          <span className="hidden text-sm font-medium text-foreground sm:inline">
            {current.title}
          </span>
        </header>

        <div className="relative flex min-h-0 flex-1 flex-col">
          <main className="@container/main flex min-h-0 w-full flex-1 flex-col overflow-y-auto p-4 md:p-6">
            <PageTransition key={location.pathname}>
              <Outlet />
            </PageTransition>
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

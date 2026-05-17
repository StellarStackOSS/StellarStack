import type { CSSProperties } from "react"
import { Link, Outlet, useLocation } from "@tanstack/react-router"

import { PageTransition } from "@/components/PageTransition"

import { Button } from "@workspace/ui/components/button"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"

import { AppSidebar } from "@/components/AppSidebar"
import type { NavItem } from "@/components/NavMain.types"
import { useSession } from "@/lib/AuthClient"

/**
 * Shell rendered for `/admin/*` routes. Owns the admin-only sidebar and
 * blocks non-admin sessions with a clear message — bouncing them to the
 * dashboard rather than silently 404-ing on the inner page.
 *
 * Mirrors the shadcn pattern: `SidebarProvider` carries
 * `--sidebar-width` + `--header-height` CSS variables, the floating
 * Sidebar sits next to a `SidebarInset`, and the inset hosts a sticky
 * top bar plus an outlet for the child page.
 */
export const AdminLayout = () => {
  const { data: session, isPending } = useSession()
  const location = useLocation()
  const items: NavItem[] = [
    { title: "Nodes", icon: "server", to: "/admin/nodes",
      isActive: location.pathname.startsWith("/admin/nodes") },
    { title: "Servers", icon: "server-stack", to: "/admin/servers",
      isActive: location.pathname.startsWith("/admin/servers") },
    { title: "Blueprints", icon: "cube", to: "/admin/blueprints",
      isActive: location.pathname.startsWith("/admin/blueprints") },
    { title: "Databases", icon: "hard-drive", to: "/admin/database-hosts",
      isActive: location.pathname.startsWith("/admin/database-hosts") },
    { title: "Users", icon: "user-multiple", to: "/admin/users",
      isActive: location.pathname.startsWith("/admin/users") },
    { title: "Audit Log", icon: "audit", to: "/admin/audit",
      isActive: location.pathname.startsWith("/admin/audit") },
    { title: "Extensions", icon: "puzzle-piece", to: "/admin/extensions",
      isActive: location.pathname.startsWith("/admin/extensions") },
  ]

  if (isPending) {
    return (
      <div className="bg-background text-foreground flex min-h-svh items-center justify-center text-sm">
        Loading session…
      </div>
    )
  }

  if (session === null || session.user.isAdmin !== true) {
    return (
      <div className="bg-background text-foreground flex min-h-svh items-center justify-center text-sm">
        <div className="text-center">
          <p>You don&apos;t have access to the admin area.</p>
          <Link to="/dashboard">
            <Button variant="outline" size="sm" className="mt-2">
              Back to dashboard
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 60)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as CSSProperties
      }
    >
      <AppSidebar
        variant="inset"
        brandLabel="StellarStack"
        brandSecondary="Admin"
        nav={{ items, label: "Manage", layoutId: "admin-nav-pill" }}
      />
      <SidebarInset>
        <header className="bg-background sticky top-0 z-10 flex h-(--header-height) items-center gap-2 px-4 md:px-6">
          <SidebarTrigger className="-ml-1" />
          <span className="text-sm font-medium">Admin</span>
        </header>
        <div className="flex flex-1 flex-col">
          <main className="@container/main mx-auto w-full max-w-5xl flex-1 px-6 pb-6">
            <PageTransition key={location.pathname}>
              <Outlet />
            </PageTransition>
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

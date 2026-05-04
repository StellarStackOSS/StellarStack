import type { CSSProperties } from "react"
import { Outlet, useLocation } from "@tanstack/react-router"
import {
  Add01Icon,
  ServerStack02Icon,
} from "@hugeicons/core-free-icons"

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"

import { AppSidebar } from "@/components/AppSidebar"
import type { NavItem } from "@/components/NavMain.types"

export const UserAreaLayout = () => {
  const location = useLocation()
  const items: NavItem[] = [
    {
      title: "Servers",
      icon: ServerStack02Icon,
      to: "/dashboard",
      isActive: location.pathname === "/dashboard",
    },
    {
      title: "New server",
      icon: Add01Icon,
      to: "/servers/new",
      isActive: location.pathname === "/servers/new",
    },
  ]
  return (
  <SidebarProvider
    style={
      {
        "--sidebar-width": "calc(var(--spacing) * 60)",
        "--header-height": "calc(var(--spacing) * 12)",
      } as CSSProperties
    }
  >
    <AppSidebar nav={{ items }} />
    <SidebarInset>
      <header className="bg-background sticky top-0 z-10 flex h-(--header-height) items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
      </header>
      <div className="flex flex-1 flex-col">
        <main className="@container/main mx-auto w-full max-w-5xl flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </SidebarInset>
  </SidebarProvider>
  )
}

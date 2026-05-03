import type { CSSProperties } from "react"
import { Outlet } from "@tanstack/react-router"

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"

import { MainSidebar } from "@/components/MainSidebar"

export const UserAreaLayout = () => (
  <SidebarProvider
    style={
      {
        "--sidebar-width": "calc(var(--spacing) * 60)",
        "--header-height": "calc(var(--spacing) * 12)",
      } as CSSProperties
    }
  >
    <MainSidebar />
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

import { Link, Outlet } from "@tanstack/react-router"

import { Button } from "@workspace/ui/components/button"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"

import { AdminSidebar } from "@/components/AdminSidebar"
import { useSession } from "@/lib/AuthClient"

/**
 * Shell rendered for `/admin/*` routes. Owns the admin-only sidebar and
 * blocks non-admin sessions with a clear message — bouncing them to the
 * dashboard rather than silently 404-ing on the inner page.
 */
export const AdminLayout = () => {
  const { data: session, isPending } = useSession()

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
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>
        <header className="border-border flex items-center gap-2 border-b px-4 py-2">
          <SidebarTrigger />
          <span className="text-muted-foreground text-xs">Admin</span>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

import { Link, useLocation } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft01Icon,
  AuditIcon,
  CubeIcon,
  ServerStack02Icon,
  ServerStackIcon,
  UserMultipleIcon,
} from "@hugeicons/core-free-icons"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar"

import { NavMain } from "@/components/NavMain"
import { NavUser } from "@/components/NavUser"
import type { NavItem } from "@/components/NavMain.types"

/**
 * Admin-only sidebar shown across `/admin/*` routes. Lives independently
 * of the server-scoped sidebar so the two contexts can evolve separately.
 */
export const AdminSidebar = ({
  ...props
}: React.ComponentProps<typeof Sidebar>) => {
  const location = useLocation()

  const items: NavItem[] = [
    {
      title: "Nodes",
      icon: ServerStackIcon,
      to: "/admin/nodes",
      isActive: location.pathname.startsWith("/admin/nodes"),
    },
    {
      title: "Servers",
      icon: ServerStack02Icon,
      to: "/admin/servers",
      isActive: location.pathname.startsWith("/admin/servers"),
    },
    {
      title: "Blueprints",
      icon: CubeIcon,
      to: "/admin/blueprints",
      isActive: location.pathname.startsWith("/admin/blueprints"),
    },
    {
      title: "Users",
      icon: UserMultipleIcon,
      to: "/admin/users",
      isActive: location.pathname.startsWith("/admin/users"),
    },
    {
      title: "Audit Log",
      icon: AuditIcon,
      to: "/admin/audit",
      isActive: location.pathname.startsWith("/admin/audit"),
    },
  ]

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              tooltip="Back to dashboard"
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <Link to="/dashboard">
                <span className="bg-sidebar-accent text-sidebar-accent-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
                </span>
                <div className="grid flex-1 text-left text-xs leading-tight">
                  <span className="truncate text-sm font-semibold">
                    StellarStack
                  </span>
                  <span className="text-muted-foreground truncate text-[0.65rem]">
                    Admin
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain label="Manage" items={items} layoutId="admin-nav-pill" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}

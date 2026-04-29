import { Link, useLocation } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft01FreeIcon,
  CubeFreeIcon,
  GlobalNetworkFreeIcon,
  UserMultipleFreeIcon,
} from "@hugeicons/core-free-icons"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar"

import { UserPopover } from "@/components/UserPopover"

const adminItems = [
  { to: "/admin/nodes", label: "Nodes", icon: GlobalNetworkFreeIcon },
  { to: "/admin/blueprints", label: "Blueprints", icon: CubeFreeIcon },
  { to: "/admin/users", label: "Users", icon: UserMultipleFreeIcon },
] as const

/**
 * Admin-only sidebar shown across `/admin/*` routes. Lives independently
 * of the server-scoped sidebar so the two contexts can evolve separately.
 */
export const AdminSidebar = () => {
  const location = useLocation()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip="Back to dashboard">
              <Link to="/dashboard">
                <span className="bg-sidebar-accent text-sidebar-accent-foreground flex aspect-square size-7 items-center justify-center rounded-md">
                  <HugeiconsIcon icon={ArrowLeft01FreeIcon} className="size-3.5" />
                </span>
                <div className="grid flex-1 text-left text-xs leading-tight">
                  <span className="truncate font-medium">StellarStack</span>
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
        <SidebarGroup>
          <SidebarGroupLabel>Manage</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminItems.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname.startsWith(item.to)}
                    tooltip={item.label}
                  >
                    <Link to={item.to}>
                      <HugeiconsIcon icon={item.icon} />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <UserPopover />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

import { Link, useLocation } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft01FreeIcon,
  Calendar03FreeIcon,
  DashboardSquare02FreeIcon,
  FolderLibraryFreeIcon,
  HardDriveFreeIcon,
  GlobalNetworkFreeIcon,
  Settings02FreeIcon,
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
import type { ServerListRow } from "@/hooks/useServers.types"

const navItems = [
  { to: "/servers/$id", path: "", label: "Overview", icon: DashboardSquare02FreeIcon },
  { to: "/servers/$id/files", path: "/files", label: "Files", icon: FolderLibraryFreeIcon },
  { to: "/servers/$id/backups", path: "/backups", label: "Backups", icon: HardDriveFreeIcon },
  { to: "/servers/$id/schedules", path: "/schedules", label: "Schedules", icon: Calendar03FreeIcon },
  { to: "/servers/$id/users", path: "/users", label: "Users", icon: UserMultipleFreeIcon },
  { to: "/servers/$id/network", path: "/network", label: "Network", icon: GlobalNetworkFreeIcon },
  { to: "/servers/$id/settings", path: "/settings", label: "Settings", icon: Settings02FreeIcon },
] as const

const stateColor: Record<string, string> = {
  installing: "bg-chart-2",
  installed_stopped: "bg-muted-foreground",
  starting: "bg-chart-2 animate-pulse",
  running: "bg-chart-1",
  stopping: "bg-chart-2 animate-pulse",
  stopped: "bg-muted-foreground",
  crashed: "bg-destructive",
}

/**
 * Sidebar shown across the per-server pages. Sidebar itself is mounted in
 * the layout route; only the content rendered through `<Outlet />` swaps
 * when the user navigates between tabs, so this component never
 * re-renders during in-server navigation.
 */
export const ServerSidebar = ({
  server,
  liveStatus,
}: {
  server: ServerListRow
  liveStatus: string | null
}) => {
  const { t } = useTranslation()
  const location = useLocation()
  const status = liveStatus ?? server.status
  const basePath = `/servers/${server.id}`
  const currentSubpath = location.pathname.startsWith(basePath)
    ? location.pathname.slice(basePath.length)
    : ""

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              tooltip={server.name}
            >
              <Link to="/dashboard">
                <span className="bg-sidebar-accent text-sidebar-accent-foreground flex aspect-square size-7 items-center justify-center rounded-md">
                  <HugeiconsIcon
                    icon={ArrowLeft01FreeIcon}
                    className="size-3.5"
                  />
                </span>
                <div className="grid flex-1 text-left text-xs leading-tight">
                  <span className="truncate font-medium">{server.name}</span>
                  <span className="text-muted-foreground flex items-center gap-1.5 truncate text-[0.65rem]">
                    <span
                      className={`size-1.5 rounded-full ${stateColor[status] ?? "bg-muted-foreground"}`}
                    />
                    {t(`lifecycle.${status}`, { ns: "common" })}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Server</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive =
                  item.path === ""
                    ? currentSubpath === "" || currentSubpath === "/"
                    : currentSubpath === item.path
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                    >
                      <Link to={item.to} params={{ id: server.id }}>
                        <HugeiconsIcon icon={item.icon} />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
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

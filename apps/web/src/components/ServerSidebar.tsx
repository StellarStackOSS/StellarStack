import { useLocation, Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDataTransferHorizontalIcon,
  ArrowLeft01Icon,
  Calendar03Icon,
  DashboardSquare02Icon,
  EthernetPortIcon,
  FolderLibraryIcon,
  HardDriveIcon,
  Settings02Icon,
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
import type { ServerListRow } from "@/hooks/useServers.types"

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
 * Per-server sidebar shell. Sidebar itself is mounted in the layout route
 * — only the content rendered through `<Outlet />` swaps when the user
 * navigates between tabs, so this component never re-renders during
 * in-server navigation.
 */
export const ServerSidebar = ({
  server,
  liveStatus,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  server: ServerListRow
  liveStatus: string | null
}) => {
  const { t } = useTranslation()
  const location = useLocation()
  const status = liveStatus ?? server.status
  const basePath = `/servers/${server.id}`
  const sub = location.pathname.startsWith(basePath)
    ? location.pathname.slice(basePath.length)
    : ""

  const items: NavItem[] = [
    {
      title: "Overview",
      icon: DashboardSquare02Icon,
      to: "/servers/$id",
      params: { id: server.id },
      isActive: sub === "" || sub === "/",
    },
    {
      title: "Files",
      icon: FolderLibraryIcon,
      to: "/servers/$id/files",
      params: { id: server.id },
      isActive: sub === "/files",
    },
    {
      title: "Backups",
      icon: HardDriveIcon,
      to: "/servers/$id/backups",
      params: { id: server.id },
      isActive: sub === "/backups",
    },
    {
      title: "Schedules",
      icon: Calendar03Icon,
      to: "/servers/$id/schedules",
      params: { id: server.id },
      isActive: sub === "/schedules",
    },
    {
      title: "Users",
      icon: UserMultipleIcon,
      to: "/servers/$id/users",
      params: { id: server.id },
      isActive: sub === "/users",
    },
    {
      title: "Network",
      icon: EthernetPortIcon,
      to: "/servers/$id/network",
      params: { id: server.id },
      isActive: sub === "/network",
    },
    {
      title: "Transfer",
      icon: ArrowDataTransferHorizontalIcon,
      to: "/servers/$id/transfer",
      params: { id: server.id },
      isActive: sub === "/transfer",
    },
    {
      title: "Settings",
      icon: Settings02Icon,
      to: "/servers/$id/settings",
      params: { id: server.id },
      isActive: sub === "/settings",
    },
  ]

  return (
    <Sidebar collapsible="icon" variant="floating" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              tooltip={server.name}
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <Link to="/dashboard">
                <span className="bg-sidebar-accent text-sidebar-accent-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
                </span>
                <div className="grid flex-1 text-left text-xs leading-tight">
                  <span className="truncate text-sm font-semibold">
                    {server.name}
                  </span>
                  <span className="text-muted-foreground flex items-center gap-1.5 truncate text-[0.65rem]">
                    <span
                      className={`size-1.5 rounded-full ${
                        stateColor[status] ?? "bg-muted-foreground"
                      }`}
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
        <NavMain label="Server" items={items} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}

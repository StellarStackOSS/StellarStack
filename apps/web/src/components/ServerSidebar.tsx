import { useLocation } from "@tanstack/react-router"
import type { ServerLifecycleState } from "@workspace/shared/events.types"
import { useTranslation } from "react-i18next"
import {
  Calendar03Icon,
  DashboardSquare02Icon,
  EthernetPortIcon,
  FolderLibraryIcon,
  HardDriveIcon,
  ComputerTerminal02Icon,
  ListViewIcon,
  Layers01Icon,
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
  const status = (liveStatus ?? server.status) as ServerLifecycleState
  const basePath = `/servers/${server.id}`
  const sub = location.pathname.startsWith(basePath)
    ? location.pathname.slice(basePath.length)
    : ""

  // status is read but only needed for potential future use; suppress lint
  void status

  const items: NavItem[] = [
    {
      title: t("sidebar.overview"),
      icon: DashboardSquare02Icon,
      to: "/servers/$id",
      params: { id: server.id },
      isActive: sub === "" || sub === "/",
    },
    {
      title: t("sidebar.files"),
      icon: FolderLibraryIcon,
      to: "/servers/$id/files",
      params: { id: server.id },
      isActive: sub === "/files",
    },
    {
      title: t("sidebar.backups"),
      icon: HardDriveIcon,
      to: "/servers/$id/backups",
      params: { id: server.id },
      isActive: sub === "/backups",
    },
    {
      title: t("sidebar.schedules"),
      icon: Calendar03Icon,
      to: "/servers/$id/schedules",
      params: { id: server.id },
      isActive: sub === "/schedules",
    },
    {
      title: t("sidebar.users"),
      icon: UserMultipleIcon,
      to: "/servers/$id/users",
      params: { id: server.id },
      isActive: sub === "/users",
    },
    {
      title: t("sidebar.network"),
      icon: EthernetPortIcon,
      to: "/servers/$id/network",
      params: { id: server.id },
      isActive: sub === "/network",
    },
    {
      title: t("sidebar.startup"),
      icon: ComputerTerminal02Icon,
      to: "/servers/$id/startup",
      params: { id: server.id },
      isActive: sub === "/startup",
    },
    {
      title: t("sidebar.instances"),
      icon: Layers01Icon,
      to: "/servers/$id/instances",
      params: { id: server.id },
      isActive: sub === "/instances",
    },
    {
      title: t("sidebar.activity"),
      icon: ListViewIcon,
      to: "/servers/$id/activity",
      params: { id: server.id },
      isActive: sub === "/activity",
    },
    {
      title: t("sidebar.settings"),
      icon: Settings02Icon,
      to: "/servers/$id/settings",
      params: { id: server.id },
      isActive: sub === "/settings",
    },
  ]

  return (
    <Sidebar variant="inset" collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              tooltip="StellarStack"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-zinc-800 text-zinc-100">
                <span className="text-[10px] font-bold tracking-tight">SS</span>
              </div>
              <span className="truncate font-semibold text-zinc-100">StellarStack</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavMain items={items} layoutId="server-nav-pill" />
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}

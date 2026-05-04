import type { CSSProperties, ReactNode } from "react"
import { Link } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons"

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
 * Single shared sidebar shell used across every authenticated section
 * of the app. Three layouts (`UserAreaLayout`, `AdminLayout`,
 * `ServerLayout`) each pick their own nav items + an optional header
 * override and pass them in — there's no per-section sidebar component
 * any more, just per-section nav data.
 */
export const AppSidebar = ({
  header,
  nav,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  /**
   * Optional override for the sidebar header. Defaults to the standard
   * "StellarStack" brand link back to the dashboard. The admin layout
   * passes a back-arrow variant; the server layout passes the brand
   * with no link (clicking the logo from inside a server is a no-op).
   */
  header?: ReactNode
  nav: {
    items: NavItem[]
    label?: string
    layoutId?: string
  }
}) => (
  <Sidebar
    collapsible="icon"
    style={{ "--sidebar-width": "calc(var(--spacing) * 60)" } as CSSProperties}
    {...props}
  >
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          {header ?? <DefaultBrandHeader />}
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
    <SidebarContent>
      <NavMain
        items={nav.items}
        label={nav.label}
        layoutId={nav.layoutId}
      />
    </SidebarContent>
    <SidebarFooter>
      <NavUser />
    </SidebarFooter>
  </Sidebar>
)

const DefaultBrandHeader = () => (
  <SidebarMenuButton
    size="lg"
    asChild
    className="data-[slot=sidebar-menu-button]:p-1.5!"
  >
    <Link to="/dashboard">
      <span className="bg-sidebar-accent text-sidebar-accent-foreground flex aspect-square size-8 items-center justify-center rounded-lg text-sm font-bold">
        S
      </span>
      <span className="truncate text-sm font-semibold">StellarStack</span>
    </Link>
  </SidebarMenuButton>
)

/**
 * Pre-built admin header: a back-arrow button that returns to the
 * dashboard, with "Admin" as the secondary label. Exported so the
 * admin layout can pass it via the `header` prop without duplicating
 * the markup.
 */
export const AdminBrandHeader = () => (
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
        <span className="truncate text-sm font-semibold">StellarStack</span>
        <span className="text-muted-foreground truncate text-[0.65rem]">
          Admin
        </span>
      </div>
    </Link>
  </SidebarMenuButton>
)

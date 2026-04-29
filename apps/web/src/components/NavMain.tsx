import { Link } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar"

import type { NavItem } from "@/components/NavMain.types"

/**
 * Primary nav block for a sidebar — mirrors shadcn's `NavMain` example.
 * Each item renders a `SidebarMenuButton` wrapping a TanStack Router
 * `<Link>` so preload + active-state stay typed.
 */
export const NavMain = ({
  label,
  items,
}: {
  label?: string
  items: NavItem[]
}) => {
  return (
    <SidebarGroup>
      {label !== undefined ? (
        <SidebarGroupLabel>{label}</SidebarGroupLabel>
      ) : null}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={`${item.to}-${item.title}`}>
              <SidebarMenuButton
                asChild
                isActive={item.isActive ?? false}
                tooltip={item.title}
              >
                <Link
                  to={item.to}
                  {...(item.params !== undefined ? { params: item.params } : {})}
                >
                  <HugeiconsIcon icon={item.icon} />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

import { useState } from "react"
import { Link } from "@tanstack/react-router"
import { AnimatePresence, motion } from "framer-motion"

import { DuoIcon } from "@/components/DuoIcon"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar"

import type { NavItem } from "@/components/NavMain.types"

export const NavMain = ({
  label,
  items,
  layoutId = "nav-pill",
}: {
  label?: string
  items: NavItem[]
  layoutId?: string
}) => {
  const [hovered, setHovered] = useState<string | null>(null)

  return (
    <SidebarGroup className="px-2 py-1">
      {label !== undefined ? (
        <SidebarGroupLabel className="px-2 text-[10px] font-medium tracking-wider text-zinc-600 uppercase">
          {label}
        </SidebarGroupLabel>
      ) : null}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem
              key={`${item.to}-${item.title}`}
              className="relative"
              onMouseEnter={() => setHovered(item.title)}
              onMouseLeave={() => setHovered(null)}
            >
              {item.isActive === true && (
                <motion.div
                  layoutId={layoutId}
                  className="absolute inset-0 rounded-md bg-white/70 group-data-[collapsible=icon]:hidden"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <AnimatePresence>
                {hovered === item.title && item.isActive !== true && (
                  <motion.div
                    key="hover"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="absolute inset-0 rounded-md bg-white/10 group-data-[collapsible=icon]:hidden"
                  />
                )}
              </AnimatePresence>
              <SidebarMenuButton
                asChild
                isActive={item.isActive ?? false}
                tooltip={item.title}
                className="relative z-10 text-xs text-muted-foreground hover:bg-transparent hover:text-foreground active:bg-transparent active:text-foreground data-[active=true]:bg-transparent data-[active=true]:text-zinc-900"
              >
                <Link
                  to={item.to}
                  {...(item.params !== undefined ? { params: item.params } : {})}
                  {...(item.search !== undefined ? { search: item.search } : {})}
                >
                  <DuoIcon
                    name={item.icon}
                    className={`size-4 shrink-0 transition-colors ${
                      item.isActive ? "text-zinc-900" : ""
                    }`}
                  />
                  <span className="ml-1 tracking-wider uppercase group-data-[collapsible=icon]:hidden">
                    {item.title}
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

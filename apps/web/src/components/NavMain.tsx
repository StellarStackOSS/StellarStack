import { useState } from "react"
import { Link } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import { AnimatePresence, motion } from "framer-motion"

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
                  className="absolute inset-0 rounded-md bg-zinc-800/80 group-data-[collapsible=icon]:hidden"
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
                    className="absolute inset-0 rounded-md bg-zinc-800/60 group-data-[collapsible=icon]:hidden"
                  />
                )}
              </AnimatePresence>
              <SidebarMenuButton
                asChild
                isActive={item.isActive ?? false}
                tooltip={item.title}
                className="relative z-10 text-xs text-zinc-400 hover:bg-transparent hover:text-zinc-100 data-[active=true]:bg-transparent data-[active=true]:text-zinc-100"
              >
                <Link
                  to={item.to}
                  {...(item.params !== undefined ? { params: item.params } : {})}
                >
                  <HugeiconsIcon icon={item.icon} className="size-4 shrink-0" />
                  <span
                    className={`ml-1 tracking-wider uppercase transition-opacity ${item.isActive ? "opacity-100" : "opacity-50"}`}
                  >
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

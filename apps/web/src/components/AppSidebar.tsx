import type { CSSProperties, ReactNode } from "react"
import { useEffect, useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDown01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@workspace/ui/components/command"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@workspace/ui/components/sidebar"

import { NavMain } from "@/components/NavMain"
import { NavUser } from "@/components/NavUser"
import type { NavItem } from "@/components/NavMain.types"

type NavSection = {
  items: NavItem[]
  label?: string
  layoutId?: string
}

/**
 * Single shared sidebar shell used across every authenticated section
 * of the app. Three layouts (UserAreaLayout, AdminLayout, ServerLayout)
 * pass their own grouped nav data; the chrome — brand dropdown row,
 * search/⌘K input, footer NavUser — is identical everywhere.
 */
export const AppSidebar = ({
  brandLabel,
  brandSecondary,
  brandIcon,
  brandHref,
  nav,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  brandLabel?: string
  brandSecondary?: string
  brandIcon?: ReactNode
  brandHref?: string
  nav: NavSection | NavSection[]
}) => {
  const sections = Array.isArray(nav) ? nav : [nav]
  const [cmdOpen, setCmdOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setCmdOpen((v) => !v)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <Sidebar
      collapsible="icon"
      style={{ "--sidebar-width": "calc(var(--spacing) * 60)" } as CSSProperties}
      {...props}
    >
      <SidebarHeader className="gap-2 p-2">
        {/* Brand row pinned to the page-header height so it lines up
            with the inset header bar across the divider. */}
        <div className="flex h-(--header-height) shrink-0 items-center gap-2">
          <Link
            to={brandHref ?? "/dashboard"}
            className="group/brand flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 hover:bg-sidebar-accent/40"
          >
            <span className="bg-sidebar-accent text-sidebar-accent-foreground flex aspect-square size-7 items-center justify-center rounded-md text-[11px] font-bold">
              {brandIcon ?? "S"}
            </span>
            <div className="flex min-w-0 flex-1 flex-col leading-tight group-data-[collapsible=icon]:hidden">
              <span className="truncate text-sm font-semibold">
                {brandLabel ?? "StellarStack"}
              </span>
              {brandSecondary !== undefined ? (
                <span className="text-muted-foreground truncate text-[0.65rem]">
                  {brandSecondary}
                </span>
              ) : null}
            </div>
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              className="text-muted-foreground size-3.5 shrink-0 group-data-[collapsible=icon]:hidden"
            />
          </Link>
        </div>

        {/* Search button styled like an input. Click or ⌘K opens
            the CommandDialog populated with every nav item. */}
        <button
          type="button"
          onClick={() => setCmdOpen(true)}
          className="group/search flex h-8 items-center gap-2 rounded-md border border-white/8 bg-background/60 px-2 text-xs text-zinc-500 transition-colors hover:border-white/15 hover:text-zinc-300 group-data-[collapsible=icon]:hidden"
        >
          <HugeiconsIcon icon={Search01Icon} className="size-3.5 shrink-0" />
          <span className="flex-1 text-left">Search</span>
          <kbd className="rounded border border-white/10 bg-zinc-900/60 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
            ⌘K
          </kbd>
        </button>
      </SidebarHeader>

      <SidebarContent>
        {sections.map((section, i) => (
          <NavMain
            key={section.label ?? `section-${i}`}
            items={section.items}
            label={section.label}
            layoutId={section.layoutId ?? `nav-pill-${i}`}
          />
        ))}
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>

      <CommandDialog
        open={cmdOpen}
        onOpenChange={setCmdOpen}
        title="Navigate"
        description="Jump to any tab"
      >
        <CommandInput placeholder="Type to filter…" />
        <CommandList>
          <CommandEmpty>No matches.</CommandEmpty>
          {sections.map((section, i) => (
            <CommandGroup
              key={section.label ?? `cmd-section-${i}`}
              heading={section.label}
            >
              {section.items.map((item) => (
                <CommandItem
                  key={`${item.to}-${item.title}`}
                  value={`${section.label ?? ""} ${item.title}`}
                  onSelect={() => {
                    setCmdOpen(false)
                    void navigate({
                      to: item.to,
                      ...(item.params !== undefined
                        ? { params: item.params }
                        : {}),
                    } as never)
                  }}
                >
                  <HugeiconsIcon icon={item.icon} className="size-4" />
                  <span>{item.title}</span>
                </CommandItem>
              ))}
              {i < sections.length - 1 ? <CommandSeparator /> : null}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </Sidebar>
  )
}

import type { LinkProps } from "@tanstack/react-router"

import type { IconName } from "@/components/Icon"

/**
 * One entry in the primary nav. `to` and `params` are TanStack Router
 * `LinkProps`; the link is rendered through `<Link>` so route preload +
 * type-safety stay intact.
 */
export type NavItem = {
  title: string
  icon: IconName
  to: LinkProps["to"]
  params?: Record<string, string>
  search?: Record<string, string>
  isActive?: boolean
}

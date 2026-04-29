import type { ComponentProps } from "react"
import type { LinkProps } from "@tanstack/react-router"
import type { HugeiconsIcon } from "@hugeicons/react"

/**
 * One entry in the primary nav. `to` and `params` are TanStack Router
 * `LinkProps`; the link is rendered through `<Link>` so route preload +
 * type-safety stay intact.
 */
export type NavItem = {
  title: string
  icon: ComponentProps<typeof HugeiconsIcon>["icon"]
  to: LinkProps["to"]
  params?: Record<string, string>
  isActive?: boolean
}

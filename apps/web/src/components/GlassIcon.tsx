import {
  IconAppStack,
  IconBulletList,
  IconCalendar,
  IconCircleArrowDown,
  IconCircleCopyPlus,
  IconClipboardCheck,
  IconCodeEditor,
  IconConnections,
  IconCube,
  IconFolder,
  IconGear,
  IconGrid,
  IconLayers,
  IconMagnifier,
  IconSitemap,
  IconStorage,
  IconTriangleWarning,
  IconUsers,
} from "nucleo-glass"
import type { IconProps as NucleoIconProps } from "nucleo-glass"
import type { FC } from "react"

import { cn } from "@workspace/ui/lib/utils"
import { Icon, type IconName } from "@/components/Icon"

/**
 * Subset of IconName covered by the glass set. Anything else falls
 * back to the outline `<Icon>` so callers can pass any IconName safely.
 */
const glassMap: Partial<Record<IconName, FC<NucleoIconProps>>> = {
  add: IconCircleCopyPlus,
  alert: IconTriangleWarning,
  "arrow-down": IconCircleArrowDown,
  audit: IconClipboardCheck,
  calendar: IconCalendar,
  console: IconCodeEditor,
  cube: IconCube,
  dashboard: IconGrid,
  ethernet: IconConnections,
  folder: IconFolder,
  "folder-library": IconFolder,
  "hard-drive": IconStorage,
  layers: IconLayers,
  "list-view": IconBulletList,
  search: IconMagnifier,
  server: IconSitemap,
  "server-stack": IconAppStack,
  settings: IconGear,
  "user-multiple": IconUsers,
}

export type GlassIconProps = NucleoIconProps & {
  name: IconName
  size?: number
}

export const GlassIcon = ({
  name,
  size = 16,
  className,
  ...rest
}: GlassIconProps) => {
  const C = glassMap[name]
  if (C === undefined) {
    return <Icon name={name} size={size} className={className} {...rest} />
  }
  return <C size={size} className={cn("shrink-0", className)} {...rest} />
}

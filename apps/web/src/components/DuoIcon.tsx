import {
  IconAlertTriangleFilled,
  IconBellFilled,
  IconBrain,
  IconCalendarFilled,
  IconCalendarPlus,
  IconChevronDown,
  IconClipboardListFilled,
  IconCopy,
  IconDots,
  IconFileFilled,
  IconFolderFilled,
  IconLayoutDashboardFilled,
  IconLayoutGridFilled,
  IconList,
  IconLogout,
  IconMoonFilled,
  IconNote,
  IconPlugConnected,
  IconPlus,
  IconPuzzleFilled,
  IconSearch,
  IconServer2,
  IconServerBolt,
  IconSettingsFilled,
  IconShieldFilled,
  IconStackFilled,
  IconSunFilled,
  IconTerminal,
  IconTerminal2,
  IconUserCircle,
  IconUsersGroup,
} from "@tabler/icons-react"
import type { Icon as TablerIcon } from "@tabler/icons-react"

import { cn } from "@workspace/ui/lib/utils"
import { Icon, type IconName } from "@/components/Icon"

/**
 * Sidebar icon wrapper. Renders the **filled** Tabler variant for
 * visual weight in the navigation rail; falls back to the outlined
 * Icon when an entry isn't mapped here.
 */
const duoMap: Partial<Record<IconName, TablerIcon>> = {
  add: IconPlus,
  ai: IconBrain,
  alert: IconAlertTriangleFilled,
  "arrow-down": IconChevronDown,
  audit: IconClipboardListFilled,
  bell: IconBellFilled,
  calendar: IconCalendarFilled,
  "calendar-plus": IconCalendarPlus,
  "clone-dashed-3": IconCopy,
  connections: IconPuzzleFilled,
  console: IconTerminal,
  cube: IconStackFilled,
  dashboard: IconLayoutDashboardFilled,
  ethernet: IconPlugConnected,
  file: IconFileFilled,
  folder: IconFolderFilled,
  "folder-library": IconFolderFilled,
  "grid-layout": IconLayoutGridFilled,
  "hard-drive": IconStackFilled,
  layers: IconStackFilled,
  "list-view": IconList,
  logout: IconLogout,
  moon: IconMoonFilled,
  "more-horizontal": IconDots,
  "note-3": IconNote,
  search: IconSearch,
  server: IconServer2,
  "server-stack": IconServerBolt,
  settings: IconSettingsFilled,
  "shield-user": IconShieldFilled,
  "square-terminal": IconTerminal2,
  sun: IconSunFilled,
  "triangle-warning": IconAlertTriangleFilled,
  user: IconUserCircle,
  "user-circle": IconUserCircle,
  "user-multiple": IconUsersGroup,
}

export type DuoIconProps = React.ComponentProps<TablerIcon> & {
  name: IconName
  size?: number
}

export const DuoIcon = ({
  name,
  size = 16,
  className,
  ...rest
}: DuoIconProps) => {
  const C = duoMap[name]
  if (C === undefined) {
    return <Icon name={name} size={size} className={className} {...rest} />
  }
  return <C size={size} className={cn("shrink-0", className)} {...rest} />
}

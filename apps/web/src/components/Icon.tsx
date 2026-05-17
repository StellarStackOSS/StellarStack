import {
  IconActivity,
  IconAlertTriangle,
  IconAlignJustified,
  IconBell,
  IconBox,
  IconBrain,
  IconCalendar,
  IconCalendarPlus,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconChevronUp,
  IconCircleCheck,
  IconCircleX,
  IconClipboardList,
  IconCopy,
  IconCube,
  IconDatabase,
  IconDots,
  IconDownload,
  IconDragDrop,
  IconFile,
  IconFilePlus,
  IconFileUpload,
  IconFolder,
  IconFolderOpen,
  IconFolderPlus,
  IconFolderUp,
  IconHash,
  IconInfoCircle,
  IconLayoutAlignLeft,
  IconLayoutDashboard,
  IconLayoutGrid,
  IconList,
  IconLoader2,
  IconLogout,
  IconMoon,
  IconPuzzle,
  IconNote,
  IconPencil,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlayerStop,
  IconPlug,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconSelector,
  IconServer,
  IconServer2,
  IconSettings,
  IconShield,
  IconStack,
  IconSun,
  IconTerminal,
  IconTerminal2,
  IconTrash,
  IconUser,
  IconUserCircle,
  IconUsers,
  IconX,
} from "@tabler/icons-react"
import type { Icon as TablerIcon } from "@tabler/icons-react"

import { cn } from "@workspace/ui/lib/utils"

/**
 * Stable, library-agnostic icon name. Add new entries here when a new
 * concept is needed; remap existing entries when swapping icon library.
 */
export type IconName =
  | "ai"
  | "add"
  | "alert"
  | "arrow-down"
  | "arrow-right"
  | "arrow-up"
  | "audit"
  | "bell"
  | "calendar"
  | "calendar-plus"
  | "cancel"
  | "clone-dashed-3"
  | "check"
  | "checkmark-circle"
  | "connections"
  | "console"
  | "cube"
  | "dashboard"
  | "delete"
  | "download"
  | "drag"
  | "ethernet"
  | "file"
  | "file-add"
  | "file-upload"
  | "folder"
  | "folder-add"
  | "folder-library"
  | "folder-open"
  | "folder-upload"
  | "grid-layout"
  | "hard-drive"
  | "hashtag"
  | "info"
  | "layers"
  | "layout-align-left"
  | "list-view"
  | "loading"
  | "logout"
  | "moon"
  | "more-horizontal"
  | "multiplication-circle"
  | "note-3"
  | "package"
  | "pause"
  | "pencil"
  | "play"
  | "power-socket"
  | "puzzle-piece"
  | "refresh"
  | "running"
  | "search"
  | "server"
  | "server-stack"
  | "settings"
  | "shield-user"
  | "square-terminal"
  | "stop"
  | "sun"
  | "text-wrap"
  | "tick"
  | "triangle-warning"
  | "unfold-more"
  | "user"
  | "user-circle"
  | "user-multiple"

const map: Record<IconName, TablerIcon> = {
  ai: IconBrain,
  add: IconPlus,
  alert: IconAlertTriangle,
  "arrow-down": IconChevronDown,
  "arrow-right": IconChevronRight,
  "arrow-up": IconChevronUp,
  audit: IconClipboardList,
  bell: IconBell,
  calendar: IconCalendar,
  "calendar-plus": IconCalendarPlus,
  cancel: IconX,
  "clone-dashed-3": IconCopy,
  check: IconCircleCheck,
  "checkmark-circle": IconCircleCheck,
  connections: IconPuzzle,
  console: IconTerminal,
  cube: IconCube,
  dashboard: IconLayoutDashboard,
  delete: IconTrash,
  download: IconDownload,
  drag: IconDragDrop,
  ethernet: IconPlug,
  file: IconFile,
  "file-add": IconFilePlus,
  "file-upload": IconFileUpload,
  folder: IconFolder,
  "folder-add": IconFolderPlus,
  "folder-library": IconFolder,
  "folder-open": IconFolderOpen,
  "folder-upload": IconFolderUp,
  "grid-layout": IconLayoutGrid,
  "hard-drive": IconDatabase,
  hashtag: IconHash,
  info: IconInfoCircle,
  layers: IconStack,
  "layout-align-left": IconLayoutAlignLeft,
  "list-view": IconList,
  loading: IconLoader2,
  logout: IconLogout,
  moon: IconMoon,
  "more-horizontal": IconDots,
  "multiplication-circle": IconCircleX,
  "note-3": IconNote,
  package: IconBox,
  pause: IconPlayerPause,
  pencil: IconPencil,
  play: IconPlayerPlay,
  "power-socket": IconPlug,
  "puzzle-piece": IconPuzzle,
  refresh: IconRefresh,
  running: IconActivity,
  search: IconSearch,
  server: IconServer,
  "server-stack": IconServer2,
  settings: IconSettings,
  "shield-user": IconShield,
  "square-terminal": IconTerminal2,
  stop: IconPlayerStop,
  sun: IconSun,
  "text-wrap": IconAlignJustified,
  tick: IconCheck,
  "triangle-warning": IconAlertTriangle,
  "unfold-more": IconSelector,
  user: IconUser,
  "user-circle": IconUserCircle,
  "user-multiple": IconUsers,
}

export type IconElementProps = React.ComponentProps<TablerIcon> & {
  name: IconName
  size?: number
}

export const Icon = ({
  name,
  size = 16,
  className,
  ...rest
}: IconElementProps) => {
  const C = map[name]
  return <C size={size} className={cn("shrink-0", className)} {...rest} />
}

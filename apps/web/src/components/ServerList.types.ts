import type { ServerListRow } from "@/hooks/useServers.types"

/**
 * Props accepted by `ServerList`.
 */
export type ServerListProps = {
  servers: ServerListRow[]
  loading: boolean
  emptyMessage?: string
}

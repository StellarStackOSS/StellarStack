import type { ServerLifecycleState } from "@workspace/shared/events.types"

/**
 * Server row as returned by `GET /admin/servers`. Includes owner and node
 * information joined server-side so the list page can show them without
 * extra requests.
 */
export type AdminServerRow = {
  id: string
  name: string
  status: ServerLifecycleState
  suspended: boolean
  memoryLimitMb: number
  cpuLimitPercent: number
  diskLimitMb: number
  dockerImage: string
  blueprintId: string
  createdAt: string
  ownerId: string
  nodeId: string
  ownerEmail: string | null
  ownerName: string | null
  nodeName: string | null
  nodeFqdn: string | null
}

/**
 * Full server detail returned by `GET /admin/servers/:id`.
 */
export type AdminServerDetail = {
  server: {
    id: string
    name: string
    status: ServerLifecycleState
    suspended: boolean
    memoryLimitMb: number
    cpuLimitPercent: number
    diskLimitMb: number
    dockerImage: string
    blueprintId: string
    nodeId: string
    ownerId: string
    primaryAllocationId: string | null
  }
  variables: Array<{ serverId: string; variableKey: string; value: string }>
  allocations: Array<{
    id: string
    nodeId: string
    ip: string
    port: number
    alias: string | null
    serverId: string | null
  }>
  blueprint: {
    id: string
    name: string
    dockerImages: Record<string, string>
    variables: Array<{
      key: string
      name: string
      default: string
      userViewable: boolean
      userEditable: boolean
    }>
  } | null
}

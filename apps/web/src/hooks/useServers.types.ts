import type { ServerLifecycleState } from "@workspace/shared/events.types"

/**
 * Wire shape returned by `GET /servers`. Fields mirror the Drizzle select;
 * timestamps are ISO strings.
 */
export type ServerListRow = {
  id: string
  ownerId: string
  nodeId: string
  blueprintId: string
  primaryAllocationId: string | null
  name: string
  description: string | null
  memoryLimitMb: number
  cpuLimitPercent: number
  diskLimitMb: number
  dockerImage: string
  status: ServerLifecycleState
  suspended: boolean
  createdAt: string
  updatedAt: string
}

/**
 * Wire shape returned by `GET /servers/:id`. Extends the list row with
 * resolved fields that require extra joins.
 */
export type ServerDetailRow = ServerListRow & {
  nodeName: string | null
}

/**
 * Body of `POST /servers`.
 */
export type CreateServerRequest = {
  name: string
  description?: string
  blueprintId: string
  nodeId: string
  allocationId?: string
  dockerImage: string
  memoryLimitMb: number
  cpuLimitPercent: number
  diskLimitMb: number
  variables?: Record<string, string>
}

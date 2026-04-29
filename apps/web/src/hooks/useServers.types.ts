import type { ServerLifecycleState } from "@workspace/shared/events.types"

/**
 * Wire shape returned by `GET /servers` and `GET /servers/:id`. Fields
 * mirror the Drizzle select; timestamps are ISO strings.
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
 * Body of `POST /servers`.
 */
export type CreateServerRequest = {
  name: string
  description?: string
  blueprintId: string
  nodeId: string
  dockerImage: string
  memoryLimitMb: number
  cpuLimitPercent: number
  diskLimitMb: number
  variables?: Record<string, string>
}

/**
 * Single allocation bound to a server, returned by
 * `GET /servers/:id/allocations`.
 */
export type ServerAllocationRow = {
  id: string
  nodeId: string
  ip: string
  port: number
  alias: string | null
  serverId: string | null
  createdAt: string
}

/**
 * Full response from `GET /servers/:id/allocations`.
 */
export type ServerAllocationsResponse = {
  allocations: ServerAllocationRow[]
  primaryAllocationId: string | null
  allocationLimit: number
}

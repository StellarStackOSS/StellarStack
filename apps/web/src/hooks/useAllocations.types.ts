/**
 * Single allocation row returned by `GET /admin/nodes/:id/allocations`.
 */
export type AllocationRow = {
  id: string
  nodeId: string
  ip: string
  port: number
  alias: string | null
  serverId: string | null
  createdAt: string
}

/**
 * Body of `POST /admin/nodes/:id/allocations`. Either `ports` or
 * `portRange` is required; `alias` is optional.
 */
export type CreateAllocationsRequest = {
  ip: string
  ports?: number[]
  portRange?: { start: number; end: number }
  alias?: string
}

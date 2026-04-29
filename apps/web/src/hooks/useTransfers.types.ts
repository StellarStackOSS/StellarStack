/**
 * A server-transfer record as returned by
 * `GET /servers/:id/transfers`.
 */
export type TransferRow = {
  id: string
  serverId: string
  sourceNodeId: string
  targetNodeId: string
  targetAllocationId: string
  status: "pending" | "running" | "completed" | "failed"
  error: string | null
  createdAt: string
  completedAt: string | null
}

/**
 * Body for `POST /servers/:id/transfer`.
 */
export type TransferInput = {
  targetNodeId: string
  targetAllocationId: string
}

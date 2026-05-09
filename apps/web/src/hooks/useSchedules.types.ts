import type {
  ScheduleEdge,
  ScheduleNode,
  ScheduleNodeKind,
  ScheduleNodeSubtype,
} from "@workspace/shared/schedule.types"

/**
 * Schedule + flow as returned by `GET /servers/:id/schedules`. Mirrors the
 * API's joined select shape so the UI doesn't have to do a second fetch
 * per row.
 */
export type ScheduleRow = {
  id: string
  serverId: string
  name: string
  cron: string
  enabled: boolean
  onlyWhenOnline: boolean
  nextRunAt: string | null
  lastRunAt: string | null
  createdAt: string
  flow: {
    nodes: ScheduleNode[]
    edges: ScheduleEdge[]
  }
}

/**
 * Body shape for create/update. The API treats nodes + edges as a full
 * replacement set on PATCH — no in-place id reuse beyond what the client
 * sends.
 */
export type ScheduleInput = {
  name: string
  cron: string
  enabled: boolean
  onlyWhenOnline: boolean
  flow: {
    nodes: Array<{
      id: string
      kind: ScheduleNodeKind
      subtype: ScheduleNodeSubtype
      payload: Record<string, unknown> | null
      position: { x: number; y: number }
    }>
    edges: Array<{
      fromNodeId: string
      toNodeId: string
    }>
  }
}

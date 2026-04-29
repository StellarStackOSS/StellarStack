/**
 * Schedule + nested task as returned by `GET /servers/:id/schedules`.
 * Mirrors the API's joined select shape so the UI doesn't have to do a
 * second fetch per row.
 */
export type ScheduleTaskRow = {
  id: string
  scheduleId: string
  sortOrder: number
  action: "power" | "command" | "backup"
  delaySeconds: number
  payload: Record<string, string | number | boolean> | null
  createdAt: string
}

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
  tasks: ScheduleTaskRow[]
}

/**
 * Body shape for create/update. The API treats tasks as a full
 * replacement set on PATCH — no in-place task ids.
 */
export type ScheduleInput = {
  name: string
  cron: string
  enabled: boolean
  onlyWhenOnline: boolean
  tasks: Array<{
    sortOrder: number
    action: "power" | "command" | "backup"
    delaySeconds: number
    payload: Record<string, string | number | boolean> | null
  }>
}

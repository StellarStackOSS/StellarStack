export type ActivityEntry = {
  id: string
  actorId: string | null
  ip: string | null
  action: string
  targetType: string | null
  targetId: string | null
  metadata: Record<string, string | number | boolean> | null
  createdAt: string
}

export type ServerActivityResponse = {
  entries: ActivityEntry[]
  offset: number
  limit: number
}

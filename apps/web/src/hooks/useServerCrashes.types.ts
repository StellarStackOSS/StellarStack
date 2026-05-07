export type CrashEntry = {
  id: string
  serverId: string
  exitCode: number
  signal: string | null
  oomKilled: boolean
  logTail: string
  occurredAt: string
}

export type ServerCrashesResponse = {
  entries: CrashEntry[]
  offset: number
  limit: number
  total: number
}

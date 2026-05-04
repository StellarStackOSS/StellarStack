import type { ServerListRow } from "@/hooks/useServers.types"

export type InstancesResponse = {
  instances: ServerListRow[]
}

export type PoolSnapshot = {
  memoryTotalMb: number
  memoryUsedMb: number
  memoryFreeMb: number
  diskTotalMb: number
  diskUsedMb: number
  diskFreeMb: number
  cpuTotalPercent: number
  cpuUsedPercent: number
  cpuFreePercent: number
}

export type CreateInstanceRequest = {
  name: string
  description?: string
  blueprintId: string
  dockerImage: string
  primaryAllocationId: string
  memoryLimitMb: number
  cpuLimitPercent: number
  diskLimitMb: number
  startupExtra?: string
  variables?: Record<string, string>
}

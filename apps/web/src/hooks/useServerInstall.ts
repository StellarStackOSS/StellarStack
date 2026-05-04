import { useQuery } from "@tanstack/react-query"

import { apiFetch } from "@/lib/ApiFetch"

export type InstallLogLine = { stream: "stdout" | "stderr"; line: string }

export type InstallStatus = {
  state: "running" | "succeeded" | "failed" | "unknown"
  startedAt?: string
  finishedAt?: string | null
  exitCode?: number | null
  log: InstallLogLine[]
}

const installKey = (serverId: string) =>
  ["servers", serverId, "install"] as const

/**
 * Polls the API for the running install job. Only refetches while the
 * job is in-flight; stops once the install settles.
 */
export const useServerInstall = (serverId: string, enabled: boolean) =>
  useQuery({
    queryKey: installKey(serverId),
    enabled,
    queryFn: () => apiFetch<InstallStatus>(`/servers/${serverId}/install`),
    refetchInterval: (q) => {
      const data = q.state.data as InstallStatus | undefined
      if (data === undefined) return 1500
      return data.state === "running" ? 1000 : false
    },
  })

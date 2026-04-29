import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/ApiFetch"
import type {
  ScheduleInput,
  ScheduleRow,
} from "@/hooks/useSchedules.types"

const listKey = (serverId: string) =>
  ["servers", serverId, "schedules"] as const

/**
 * Subscribe to a server's schedule list. Polled every 30s so the
 * `nextRunAt`/`lastRunAt` columns track the worker tick without manual
 * reload. The poll interval matches the worker's tick to avoid
 * showing a "due" timestamp for longer than necessary.
 */
export const useSchedules = (serverId: string) =>
  useQuery({
    queryKey: listKey(serverId),
    queryFn: () =>
      apiFetch<{ schedules: ScheduleRow[] }>(`/servers/${serverId}/schedules`),
    refetchInterval: 30_000,
  })

/**
 * Insert a new schedule + its task list. The API recomputes `nextRunAt`
 * from the cron expression on insert.
 */
export const useCreateSchedule = (serverId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: ScheduleInput) =>
      apiFetch<{ schedule: ScheduleRow }>(`/servers/${serverId}/schedules`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: listKey(serverId) })
    },
  })
}

/**
 * Replace a schedule's metadata + task list. The task array is treated
 * as a full replacement on the API side.
 */
export const useUpdateSchedule = (serverId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: { scheduleId: string } & Partial<ScheduleInput>) =>
      apiFetch<{ schedule: ScheduleRow }>(
        `/servers/${serverId}/schedules/${params.scheduleId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            name: params.name,
            cron: params.cron,
            enabled: params.enabled,
            onlyWhenOnline: params.onlyWhenOnline,
            tasks: params.tasks,
          }),
        }
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: listKey(serverId) })
    },
  })
}

/**
 * Delete a schedule (cascades through `schedule_tasks`).
 */
export const useDeleteSchedule = (serverId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (scheduleId: string) =>
      apiFetch<{ ok: true }>(`/servers/${serverId}/schedules/${scheduleId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: listKey(serverId) })
    },
  })
}

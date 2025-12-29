import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { servers, Schedule, CreateScheduleData } from "@/lib/api";

export const scheduleKeys = {
  all: (serverId: string) => ["schedules", serverId] as const,
  lists: (serverId: string) => [...scheduleKeys.all(serverId), "list"] as const,
  list: (serverId: string) => [...scheduleKeys.lists(serverId)] as const,
  details: (serverId: string) => [...scheduleKeys.all(serverId), "detail"] as const,
  detail: (serverId: string, scheduleId: string) => [...scheduleKeys.details(serverId), scheduleId] as const,
};

export const useSchedules = (serverId: string | undefined) => {
  return useQuery({
    queryKey: scheduleKeys.list(serverId!),
    queryFn: () => servers.schedules.list(serverId!),
    enabled: !!serverId,
  });
};

export const useSchedule = (serverId: string | undefined, scheduleId: string | undefined) => {
  return useQuery({
    queryKey: scheduleKeys.detail(serverId!, scheduleId!),
    queryFn: () => servers.schedules.get(serverId!, scheduleId!),
    enabled: !!serverId && !!scheduleId,
  });
};

export const useScheduleMutations = (serverId: string) => {
  const queryClient = useQueryClient();

  const invalidateSchedules = () => {
    queryClient.invalidateQueries({ queryKey: scheduleKeys.all(serverId) });
  };

  const create = useMutation({
    mutationFn: (data: CreateScheduleData) => servers.schedules.create(serverId, data),
    onSuccess: invalidateSchedules,
  });

  const update = useMutation({
    mutationFn: ({ scheduleId, data }: { scheduleId: string; data: Partial<CreateScheduleData> }) =>
      servers.schedules.update(serverId, scheduleId, data),
    onSuccess: invalidateSchedules,
  });

  const remove = useMutation({
    mutationFn: (scheduleId: string) => servers.schedules.delete(serverId, scheduleId),
    onSuccess: invalidateSchedules,
  });

  const run = useMutation({
    mutationFn: (scheduleId: string) => servers.schedules.run(serverId, scheduleId),
    onSuccess: invalidateSchedules,
  });

  return { create, update, remove, run };
};

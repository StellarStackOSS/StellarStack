import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { servers, Backup } from "@/lib/Api";

export const backupKeys = {
  all: (serverId: string) => ["backups", serverId] as const,
  lists: (serverId: string) => [...backupKeys.all(serverId), "list"] as const,
  list: (serverId: string) => [...backupKeys.lists(serverId)] as const,
};

export const useBackups = (serverId: string | undefined) => {
  return useQuery({
    queryKey: backupKeys.list(serverId!),
    queryFn: () => servers.backups.list(serverId!),
    enabled: !!serverId,
  });
};

export const useBackupMutations = (serverId: string) => {
  const queryClient = useQueryClient();

  const invalidateBackups = () => {
    queryClient.invalidateQueries({ queryKey: backupKeys.all(serverId) });
  };

  const create = useMutation({
    mutationFn: (data: { name?: string; ignore?: string[]; locked?: boolean }) =>
      servers.backups.create(serverId, data),
    onMutate: async (data) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: backupKeys.list(serverId) });

      // Snapshot the previous value
      const previousBackups = queryClient.getQueryData<Backup[]>(backupKeys.list(serverId));

      // Optimistically add the new backup with IN_PROGRESS status
      const optimisticBackup: Backup = {
        id: crypto.randomUUID(),
        name: data.name || `Backup ${new Date().toLocaleDateString()}`,
        size: 0,
        checksumType: "sha256",
        status: "IN_PROGRESS",
        isLocked: data.locked || false,
        serverId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      queryClient.setQueryData<Backup[]>(backupKeys.list(serverId), (old) => [
        optimisticBackup,
        ...(old || []),
      ]);

      return { previousBackups };
    },
    onError: (err, data, context) => {
      // Rollback on error
      if (context?.previousBackups) {
        queryClient.setQueryData(backupKeys.list(serverId), context.previousBackups);
      }
    },
    onSettled: invalidateBackups,
  });

  const restore = useMutation({
    mutationFn: (backupId: string) => servers.backups.restore(serverId, backupId),
    onSuccess: invalidateBackups,
  });

  const remove = useMutation({
    mutationFn: (backupId: string) => servers.backups.delete(serverId, backupId),
    onSuccess: invalidateBackups,
  });

  const lock = useMutation({
    mutationFn: ({ backupId, locked }: { backupId: string; locked: boolean }) =>
      servers.backups.lock(serverId, backupId, locked),
    onSuccess: invalidateBackups,
  });

  const getDownloadToken = useMutation({
    mutationFn: (backupId: string) => servers.backups.getDownloadToken(serverId, backupId),
  });

  return { create, restore, remove, lock, getDownloadToken };
};

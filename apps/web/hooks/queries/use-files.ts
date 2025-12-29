import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { servers, FileList, FileInfo } from "@/lib/api";

export const fileKeys = {
  all: (serverId: string) => ["files", serverId] as const,
  lists: (serverId: string) => [...fileKeys.all(serverId), "list"] as const,
  list: (serverId: string, path?: string) => [...fileKeys.lists(serverId), path || "/"] as const,
  content: (serverId: string, path: string) => [...fileKeys.all(serverId), "content", path] as const,
  diskUsage: (serverId: string) => [...fileKeys.all(serverId), "diskUsage"] as const,
};

export const useFiles = (serverId: string | undefined, path?: string) => {
  return useQuery({
    queryKey: fileKeys.list(serverId!, path),
    queryFn: () => servers.files.list(serverId!, path),
    enabled: !!serverId,
  });
};

export const useFileContent = (serverId: string | undefined, path: string | undefined) => {
  return useQuery({
    queryKey: fileKeys.content(serverId!, path!),
    queryFn: () => servers.files.read(serverId!, path!),
    enabled: !!serverId && !!path,
    staleTime: 0, // Always fetch fresh content when editing
  });
};

export const useDiskUsage = (serverId: string | undefined) => {
  return useQuery({
    queryKey: fileKeys.diskUsage(serverId!),
    queryFn: () => servers.files.diskUsage(serverId!),
    enabled: !!serverId,
  });
};

export const useFileMutations = (serverId: string) => {
  const queryClient = useQueryClient();

  const invalidateFiles = (path?: string) => {
    // Invalidate the list at the specific path
    if (path) {
      const parentPath = path.split("/").slice(0, -1).join("/") || "/";
      queryClient.invalidateQueries({ queryKey: fileKeys.list(serverId, parentPath) });
    }
    // Also invalidate root listing
    queryClient.invalidateQueries({ queryKey: fileKeys.lists(serverId) });
    // Invalidate disk usage
    queryClient.invalidateQueries({ queryKey: fileKeys.diskUsage(serverId) });
  };

  const write = useMutation({
    mutationFn: ({ path, content }: { path: string; content: string }) =>
      servers.files.write(serverId, path, content),
    onSuccess: (_, { path }) => {
      queryClient.invalidateQueries({ queryKey: fileKeys.content(serverId, path) });
      invalidateFiles(path);
    },
  });

  const create = useMutation({
    mutationFn: ({ path, type, content }: { path: string; type: "file" | "directory"; content?: string }) =>
      servers.files.create(serverId, path, type, content),
    onSuccess: (_, { path }) => invalidateFiles(path),
  });

  const remove = useMutation({
    mutationFn: (path: string) => servers.files.delete(serverId, path),
    onSuccess: (_, path) => invalidateFiles(path),
  });

  const rename = useMutation({
    mutationFn: ({ from, to }: { from: string; to: string }) =>
      servers.files.rename(serverId, from, to),
    onSuccess: (_, { from }) => invalidateFiles(from),
  });

  const getDownloadToken = useMutation({
    mutationFn: (path: string) => servers.files.getDownloadToken(serverId, path),
  });

  return { write, create, remove, rename, getDownloadToken };
};

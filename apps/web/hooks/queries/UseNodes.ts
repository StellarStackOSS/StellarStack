import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { nodes, Node, CreateNodeData } from "@/lib/Api";

export const nodeKeys = {
  all: ["nodes"] as const,
  lists: () => [...nodeKeys.all, "list"] as const,
  list: () => [...nodeKeys.lists()] as const,
  details: () => [...nodeKeys.all, "detail"] as const,
  detail: (id: string) => [...nodeKeys.details(), id] as const,
  stats: (id: string) => [...nodeKeys.all, "stats", id] as const,
};

export const useNodes = () => {
  return useQuery({
    queryKey: nodeKeys.list(),
    queryFn: () => nodes.list(),
  });
};

export const useNode = (id: string | undefined) => {
  return useQuery({
    queryKey: nodeKeys.detail(id!),
    queryFn: () => nodes.get(id!),
    enabled: !!id,
  });
};

export const useNodeStats = (id: string | undefined) => {
  return useQuery({
    queryKey: nodeKeys.stats(id!),
    queryFn: () => nodes.getStats(id!),
    enabled: !!id,
    refetchInterval: 5000, // Refresh every 5 seconds
  });
};

export const useNodeMutations = () => {
  const queryClient = useQueryClient();

  const invalidateNodes = () => {
    queryClient.invalidateQueries({ queryKey: nodeKeys.all });
  };

  const create = useMutation({
    mutationFn: (data: CreateNodeData) => nodes.create(data),
    onSuccess: invalidateNodes,
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateNodeData> }) =>
      nodes.update(id, data),
    onSuccess: invalidateNodes,
  });

  const remove = useMutation({
    mutationFn: (id: string) => nodes.delete(id),
    onSuccess: invalidateNodes,
  });

  const regenerateToken = useMutation({
    mutationFn: (id: string) => nodes.regenerateToken(id),
    onSuccess: invalidateNodes,
  });

  const addAllocation = useMutation({
    mutationFn: ({
      nodeId,
      data,
    }: {
      nodeId: string;
      data: { ip: string; port: number; alias?: string };
    }) => nodes.addAllocation(nodeId, data),
    onSuccess: invalidateNodes,
  });

  const addAllocationRange = useMutation({
    mutationFn: ({
      nodeId,
      data,
    }: {
      nodeId: string;
      data: { ip: string; startPort: number; endPort: number };
    }) => nodes.addAllocationRange(nodeId, data),
    onSuccess: invalidateNodes,
  });

  const deleteAllocation = useMutation({
    mutationFn: ({ nodeId, allocationId }: { nodeId: string; allocationId: string }) =>
      nodes.deleteAllocation(nodeId, allocationId),
    onSuccess: invalidateNodes,
  });

  return {
    create,
    update,
    remove,
    regenerateToken,
    addAllocation,
    addAllocationRange,
    deleteAllocation,
  };
};

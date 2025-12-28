import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { blueprints, Blueprint, CreateBlueprintData, PterodactylEgg } from "@/lib/api";

export const blueprintKeys = {
  all: ["blueprints"] as const,
  lists: () => [...blueprintKeys.all, "list"] as const,
  list: () => [...blueprintKeys.lists()] as const,
  details: () => [...blueprintKeys.all, "detail"] as const,
  detail: (id: string) => [...blueprintKeys.details(), id] as const,
};

export function useBlueprints() {
  return useQuery({
    queryKey: blueprintKeys.list(),
    queryFn: () => blueprints.list(),
  });
}

export function useBlueprint(id: string | undefined) {
  return useQuery({
    queryKey: blueprintKeys.detail(id!),
    queryFn: () => blueprints.get(id!),
    enabled: !!id,
  });
}

export function useBlueprintMutations() {
  const queryClient = useQueryClient();

  const invalidateBlueprints = () => {
    queryClient.invalidateQueries({ queryKey: blueprintKeys.all });
  };

  const create = useMutation({
    mutationFn: (data: CreateBlueprintData) => blueprints.create(data),
    onSuccess: invalidateBlueprints,
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateBlueprintData> }) =>
      blueprints.update(id, data),
    onSuccess: invalidateBlueprints,
  });

  const remove = useMutation({
    mutationFn: (id: string) => blueprints.delete(id),
    onSuccess: invalidateBlueprints,
  });

  const importEgg = useMutation({
    mutationFn: (egg: PterodactylEgg) => blueprints.importEgg(egg),
    onSuccess: invalidateBlueprints,
  });

  const exportEgg = useMutation({
    mutationFn: (id: string) => blueprints.exportEgg(id),
  });

  return { create, update, remove, importEgg, exportEgg };
}

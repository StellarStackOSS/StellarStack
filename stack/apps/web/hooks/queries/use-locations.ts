import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { locations, Location, CreateLocationData } from "@/lib/api";

export const locationKeys = {
  all: ["locations"] as const,
  lists: () => [...locationKeys.all, "list"] as const,
  list: () => [...locationKeys.lists()] as const,
  details: () => [...locationKeys.all, "detail"] as const,
  detail: (id: string) => [...locationKeys.details(), id] as const,
};

export const useLocations = () => {
  return useQuery({
    queryKey: locationKeys.list(),
    queryFn: () => locations.list(),
  });
};

export const useLocation = (id: string | undefined) => {
  return useQuery({
    queryKey: locationKeys.detail(id!),
    queryFn: () => locations.get(id!),
    enabled: !!id,
  });
};

export const useLocationMutations = () => {
  const queryClient = useQueryClient();

  const invalidateLocations = () => {
    queryClient.invalidateQueries({ queryKey: locationKeys.all });
  };

  const create = useMutation({
    mutationFn: (data: CreateLocationData) => locations.create(data),
    onSuccess: invalidateLocations,
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateLocationData> }) =>
      locations.update(id, data),
    onSuccess: invalidateLocations,
  });

  const remove = useMutation({
    mutationFn: (id: string) => locations.delete(id),
    onSuccess: invalidateLocations,
  });

  return { create, update, remove };
};

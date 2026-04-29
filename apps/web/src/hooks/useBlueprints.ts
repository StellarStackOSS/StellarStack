import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type { Blueprint } from "@workspace/shared/blueprint.types"

import { apiFetch } from "@/lib/ApiFetch"
import type { BlueprintListRow } from "@/hooks/useBlueprints.types"

const LIST_KEY = ["admin", "blueprints"] as const
const detailKey = (id: string) =>
  ["admin", "blueprints", id] as const

/**
 * Subscribe to the admin blueprint list.
 */
export const useBlueprints = () =>
  useQuery({
    queryKey: LIST_KEY,
    queryFn: () =>
      apiFetch<{ blueprints: BlueprintListRow[] }>("/admin/blueprints"),
  })

/**
 * Subscribe to a single blueprint by id. Used by the edit page to seed the
 * editor with the persisted JSON.
 */
export const useBlueprint = (id: string | null) =>
  useQuery({
    queryKey: id !== null ? detailKey(id) : ["admin", "blueprints", "_none"],
    queryFn: () =>
      apiFetch<{ blueprint: BlueprintListRow }>(
        `/admin/blueprints/${id ?? ""}`
      ),
    enabled: id !== null,
  })

/**
 * Mutation: create a blueprint from a fully-typed `Blueprint` value. The
 * server re-validates with the same Zod schema so client-side parsing here
 * is a safety net, not a trust boundary.
 */
export const useCreateBlueprint = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: Blueprint) =>
      apiFetch<{ blueprint: BlueprintListRow }>("/admin/blueprints", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LIST_KEY })
    },
  })
}

/**
 * Mutation: replace an existing blueprint.
 */
export const useUpdateBlueprint = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: { id: string; body: Blueprint }) =>
      apiFetch<{ blueprint: BlueprintListRow }>(
        `/admin/blueprints/${params.id}`,
        {
          method: "PUT",
          body: JSON.stringify(params.body),
        }
      ),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: LIST_KEY })
      void queryClient.invalidateQueries({ queryKey: detailKey(vars.id) })
    },
  })
}

/**
 * Mutation: delete a blueprint.
 */
export const useDeleteBlueprint = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: true }>(`/admin/blueprints/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LIST_KEY })
    },
  })
}

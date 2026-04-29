import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/ApiFetch"
import type { AdminUserRow } from "@/hooks/useAdminUsers.types"

const QUERY_KEY = ["admin", "users"] as const

export const useAdminUsers = () =>
  useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => apiFetch<{ users: AdminUserRow[] }>("/admin/users"),
  })

export const useUpdateAdminUser = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: {
      userId: string
      isAdmin?: boolean
      emailVerified?: boolean
    }) =>
      apiFetch<{ user: AdminUserRow }>(`/admin/users/${params.userId}`, {
        method: "PATCH",
        body: JSON.stringify({
          isAdmin: params.isAdmin,
          emailVerified: params.emailVerified,
        }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}

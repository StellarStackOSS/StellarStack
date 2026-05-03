import { useMutation, useQueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/ApiFetch"
import { authClient } from "@/lib/AuthClient"

type UpdateProfileRequest = {
  name?: string
  preferredLocale?: string
  image?: string | null
}

type ChangePasswordRequest = {
  currentPassword: string
  newPassword: string
}

export const useUpdateProfile = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: UpdateProfileRequest) =>
      apiFetch("/me", { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["session"] })
    },
  })
}

export const useChangePassword = () =>
  useMutation({
    mutationFn: ({ currentPassword, newPassword }: ChangePasswordRequest) =>
      authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: false,
      }),
  })

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"

import { useAdminUsers, useUpdateAdminUser } from "@/hooks/useAdminUsers"
import type { AdminUserRow } from "@/hooks/useAdminUsers.types"

type UserRowProps = {
  user: AdminUserRow
}

const UserRow = ({ user }: UserRowProps) => {
  const update = useUpdateAdminUser()

  return (
    <tr className="border-b last:border-0 hover:bg-muted/30">
      <td className="px-4 py-3">
        <div className="font-medium">{user.name}</div>
        <div className="text-xs text-muted-foreground">{user.email}</div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {user.isAdmin && (
            <Badge variant="default" className="text-xs">
              Admin
            </Badge>
          )}
          {user.emailVerified ? (
            <Badge variant="secondary" className="text-xs">
              Verified
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              Unverified
            </Badge>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {new Date(user.createdAt).toLocaleDateString()}
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={update.isPending}
            onClick={() =>
              update.mutate({ userId: user.id, isAdmin: !user.isAdmin })
            }
          >
            {user.isAdmin ? "Revoke Admin" : "Grant Admin"}
          </Button>
          {!user.emailVerified && (
            <Button
              variant="ghost"
              size="sm"
              disabled={update.isPending}
              onClick={() =>
                update.mutate({ userId: user.id, emailVerified: true })
              }
            >
              Verify Email
            </Button>
          )}
        </div>
      </td>
    </tr>
  )
}

export const AdminUsersPage = () => {
  const { data, isLoading } = useAdminUsers()
  const users = data?.users ?? []

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-sm text-muted-foreground">
          Manage panel accounts, admin roles, and email verification.
        </p>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}

      <div className="rounded-lg border overflow-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                User
              </th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                Status
              </th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                Joined
              </th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && !isLoading && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-6 text-center text-muted-foreground"
                >
                  No users found.
                </td>
              </tr>
            )}
            {users.map((u) => (
              <UserRow key={u.id} user={u} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

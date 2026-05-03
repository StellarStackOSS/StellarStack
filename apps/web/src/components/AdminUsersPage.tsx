import { useTranslation } from "react-i18next"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardHeader, CardInner, CardTitle } from "@workspace/ui/components/card"

import { useAdminUsers, useUpdateAdminUser } from "@/hooks/useAdminUsers"
import type { AdminUserRow } from "@/hooks/useAdminUsers.types"

type UserRowProps = {
  user: AdminUserRow
}

const UserRow = ({ user }: UserRowProps) => {
  const { t } = useTranslation()
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
              {t("admin_users.badge.admin")}
            </Badge>
          )}
          {user.emailVerified ? (
            <Badge variant="secondary" className="text-xs">
              {t("admin_users.badge.verified")}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              {t("admin_users.badge.unverified")}
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
            {user.isAdmin ? t("admin_users.revoke_admin") : t("admin_users.grant_admin")}
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
              {t("admin_users.verify_email")}
            </Button>
          )}
        </div>
      </td>
    </tr>
  )
}

export const AdminUsersPage = () => {
  const { t } = useTranslation()
  const { data, isLoading } = useAdminUsers()
  const users = data?.users ?? []

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-base font-semibold">{t("admin_users.title")}</h1>
        <p className="text-muted-foreground text-xs">
          {t("admin_users.description")}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin_users.all_heading")}</CardTitle>
        </CardHeader>
        <CardInner className="p-3">
          {isLoading ? (
            <p className="text-muted-foreground text-xs">{t("admin_users.loading")}</p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                      {t("admin_users.col.user")}
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                      {t("admin_users.col.status")}
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                      {t("admin_users.col.joined")}
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                      {t("admin_users.col.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-6 text-center text-muted-foreground"
                      >
                        {t("admin_users.empty")}
                      </td>
                    </tr>
                  ) : null}
                  {users.map((u) => (
                    <UserRow key={u.id} user={u} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </CardInner>
      </Card>
    </div>
  )
}

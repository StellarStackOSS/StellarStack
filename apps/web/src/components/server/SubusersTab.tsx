import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardInner,
  CardTitle,
} from "@workspace/ui/components/card"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import { daemonJwtScopes } from "@workspace/shared/jwt"
import type { DaemonJwtScope } from "@workspace/shared/jwt.types"

import { ApiFetchError } from "@/lib/ApiFetch"
import { translateApiError } from "@/lib/TranslateError"
import { useServerLayout } from "@/components/ServerLayoutContext"
import {
  useDeleteSubuser,
  useInviteSubuser,
  useSubusers,
  useUpdateSubuser,
} from "@/hooks/useSubusers"
import type { SubuserRow } from "@/hooks/useSubusers.types"

const scopeGroups: Array<{ label: string; scopes: DaemonJwtScope[] }> = [
  { label: "Console", scopes: ["console.read", "console.write"] },
  { label: "Stats", scopes: ["stats.read"] },
  { label: "Files", scopes: ["files.read", "files.write", "files.delete"] },
  { label: "SFTP", scopes: ["sftp"] },
  { label: "Backups", scopes: ["backup.read", "backup.write"] },
  { label: "Transfers", scopes: ["transfer.source", "transfer.target"] },
]

const allScopes = daemonJwtScopes as readonly DaemonJwtScope[]

const defaultPermissions: DaemonJwtScope[] = [
  "console.read",
  "stats.read",
  "files.read",
]

const togglePermission = (
  current: DaemonJwtScope[],
  scope: DaemonJwtScope
): DaemonJwtScope[] =>
  current.includes(scope)
    ? current.filter((s) => s !== scope)
    : [...current, scope]

/**
 * `/servers/$id/users` — owner-facing subuser CRUD. Lists every subuser
 * with their permission set, lets the owner invite an existing account by
 * email, edit a row's scopes inline, or revoke. Subusers themselves get a
 * 403 from the API and see an inline message.
 */
export const SubusersTab = () => {
  const { t } = useTranslation()
  const { server } = useServerLayout()
  const subusers = useSubusers(server.id)
  const inviteSubuser = useInviteSubuser(server.id)
  const updateSubuser = useUpdateSubuser(server.id)
  const deleteSubuser = useDeleteSubuser(server.id)

  const [inviteEmail, setInviteEmail] = useState("")
  const [invitePermissions, setInvitePermissions] =
    useState<DaemonJwtScope[]>(defaultPermissions)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editPermissions, setEditPermissions] = useState<DaemonJwtScope[]>([])

  const rows = subusers.data?.subusers ?? []

  const handleInvite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    if (invitePermissions.length === 0) {
      setErrorMessage(t("subusers.error.no_permission"))
      return
    }
    try {
      await inviteSubuser.mutateAsync({
        email: inviteEmail.trim(),
        permissions: invitePermissions,
      })
      setInviteEmail("")
      setInvitePermissions(defaultPermissions)
    } catch (err) {
      if (err instanceof ApiFetchError) {
        setErrorMessage(translateApiError(t, err.body.error))
      } else {
        setErrorMessage(t("internal.unexpected", { ns: "errors" }))
      }
    }
  }

  const startEdit = (row: SubuserRow) => {
    setEditingId(row.id)
    setEditPermissions(
      row.permissions.filter((scope): scope is DaemonJwtScope =>
        (allScopes as readonly string[]).includes(scope)
      )
    )
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditPermissions([])
  }

  const handleSave = async (subuserId: string) => {
    setErrorMessage(null)
    if (editPermissions.length === 0) {
      setErrorMessage(t("subusers.error.no_permission"))
      return
    }
    try {
      await updateSubuser.mutateAsync({
        subuserId,
        permissions: editPermissions,
      })
      cancelEdit()
    } catch (err) {
      if (err instanceof ApiFetchError) {
        setErrorMessage(translateApiError(t, err.body.error))
      } else {
        setErrorMessage(t("internal.unexpected", { ns: "errors" }))
      }
    }
  }

  const handleDelete = async (row: SubuserRow) => {
    if (!window.confirm(t("subusers.confirm.revoke", { email: row.email }))) {
      return
    }
    setErrorMessage(null)
    try {
      await deleteSubuser.mutateAsync(row.id)
    } catch (err) {
      if (err instanceof ApiFetchError) {
        setErrorMessage(translateApiError(t, err.body.error))
      } else {
        setErrorMessage(t("internal.unexpected", { ns: "errors" }))
      }
    }
  }

  if (subusers.isError) {
    return (
      <div className="flex flex-col gap-4">
        <header>
          <h1 className="text-base font-semibold">{t("subusers.title")}</h1>
          <p className="text-muted-foreground text-xs">
            {t("subusers.description")}
          </p>
        </header>
        <Card>
          <CardInner className="p-3">
            <p className="text-muted-foreground text-xs">
              {t("subusers.owner_only")}
            </p>
          </CardInner>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{t("subusers.title")}</CardTitle>
        </CardHeader>
        <CardInner className="p-3">
          <p className="text-sm text-muted-foreground">{t("subusers.description")}</p>
        </CardInner>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("subusers.invite_heading")}</CardTitle>
          <CardDescription>{t("subusers.invite_description")}</CardDescription>
        </CardHeader>
        <CardInner className="p-3 flex flex-col gap-3">
          <form onSubmit={handleInvite} className="flex flex-col gap-3">
            <Input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder={t("subusers.invite_placeholder")}
              className="max-w-sm text-xs"
            />
            <PermissionGrid
              value={invitePermissions}
              onChange={setInvitePermissions}
            />
            <div>
              <Button
                size="sm"
                type="submit"
                disabled={inviteSubuser.isPending || inviteEmail.trim() === ""}
              >
                {t("subusers.invite_button")}
              </Button>
            </div>
          </form>
          {errorMessage !== null ? (
            <p className="text-destructive text-xs" role="alert">
              {errorMessage}
            </p>
          ) : null}
          </CardInner>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("subusers.list_heading")}</CardTitle>
          <CardAction>
            <span className="text-muted-foreground text-xs">
              {t(
                rows.length === 1
                  ? "subusers.count_one"
                  : "subusers.count_other",
                { count: rows.length }
              )}
            </span>
          </CardAction>
        </CardHeader>
        <CardInner className="p-3">
        {subusers.isLoading ? (
          <p className="text-muted-foreground text-xs">{t("subusers.loading")}</p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            {t("subusers.empty")}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className="border-border flex flex-col gap-2 rounded border px-3 py-2 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{row.email}</div>
                    <div className="text-muted-foreground truncate">
                      {row.name ?? "—"} · {row.permissions.length} scope
                      {row.permissions.length === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {editingId === row.id ? (
                      <>
                        <Button
                          size="xs"
                          onClick={() => void handleSave(row.id)}
                          disabled={updateSubuser.isPending}
                        >
                          {t("subusers.save")}
                        </Button>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={cancelEdit}
                        >
                          {t("subusers.cancel")}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => startEdit(row)}
                        >
                          {t("subusers.edit")}
                        </Button>
                        <Button
                          size="xs"
                          variant="destructive"
                          disabled={deleteSubuser.isPending}
                          onClick={() => void handleDelete(row)}
                        >
                          {t("subusers.revoke")}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {editingId === row.id ? (
                  <PermissionGrid
                    value={editPermissions}
                    onChange={setEditPermissions}
                  />
                ) : (
                  <div className="text-muted-foreground flex flex-wrap gap-1">
                    {row.permissions.map((scope) => (
                      <span
                        key={scope}
                        className="bg-muted rounded px-1.5 py-0.5 font-mono text-[0.65rem]"
                      >
                        {scope}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        </CardInner>
      </Card>
    </div>
  )
}

const PermissionGrid = (props: {
  value: DaemonJwtScope[]
  onChange: (next: DaemonJwtScope[]) => void
}) => {
  const { value, onChange } = props
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {scopeGroups.map((group) => (
        <fieldset
          key={group.label}
          className="border-border flex flex-col gap-1 rounded border px-2 py-2"
        >
          <legend className="text-muted-foreground px-1 text-[0.65rem] uppercase">
            {group.label}
          </legend>
          {group.scopes.map((scope) => (
            <label
              key={scope}
              className="flex items-center gap-2 font-mono text-[0.7rem]"
            >
              <Checkbox
                checked={value.includes(scope)}
                onCheckedChange={() => onChange(togglePermission(value, scope))}
              />
              <span>{scope}</span>
            </label>
          ))}
        </fieldset>
      ))}
    </div>
  )
}

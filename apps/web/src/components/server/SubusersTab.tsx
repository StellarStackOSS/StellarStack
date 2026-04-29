import { useState } from "react"

import { Button } from "@workspace/ui/components/button"
import { daemonJwtScopes } from "@workspace/shared/jwt"
import type { DaemonJwtScope } from "@workspace/shared/jwt.types"

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
      setErrorMessage("Pick at least one permission.")
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
      setErrorMessage(err instanceof Error ? err.message : String(err))
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
      setErrorMessage("Pick at least one permission.")
      return
    }
    try {
      await updateSubuser.mutateAsync({
        subuserId,
        permissions: editPermissions,
      })
      cancelEdit()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err))
    }
  }

  const handleDelete = async (row: SubuserRow) => {
    if (!window.confirm(`Revoke ${row.email}'s access to this server?`)) {
      return
    }
    setErrorMessage(null)
    try {
      await deleteSubuser.mutateAsync(row.id)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err))
    }
  }

  if (subusers.isError) {
    return (
      <div className="flex flex-col gap-4">
        <header>
          <h1 className="text-base font-semibold">Users</h1>
          <p className="text-muted-foreground text-xs">
            Subusers + per-server permission scopes.
          </p>
        </header>
        <section className="border-border bg-card text-card-foreground rounded-md border p-4">
          <p className="text-muted-foreground text-xs">
            Only the server owner (or an admin) can manage subusers.
          </p>
        </section>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-base font-semibold">Users</h1>
        <p className="text-muted-foreground text-xs">
          Grant other accounts narrow access — console, files, SFTP, backups
          — without handing over ownership.
        </p>
      </header>

      <section className="border-border bg-card text-card-foreground flex flex-col gap-3 rounded-md border p-4">
        <header>
          <h2 className="text-sm font-medium">Invite</h2>
          <p className="text-muted-foreground text-xs">
            The email must already have a panel account.
          </p>
        </header>
        <form onSubmit={handleInvite} className="flex flex-col gap-3">
          <input
            type="email"
            required
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="user@example.com"
            className="border-border bg-background h-8 max-w-sm rounded-md border px-2 text-xs"
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
              Invite
            </Button>
          </div>
        </form>
        {errorMessage !== null ? (
          <p className="text-destructive text-xs" role="alert">
            {errorMessage}
          </p>
        ) : null}
      </section>

      <section className="border-border bg-card text-card-foreground rounded-md border p-4">
        <header className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium">Subusers</h2>
          <span className="text-muted-foreground text-xs">
            {rows.length} subuser{rows.length === 1 ? "" : "s"}
          </span>
        </header>
        {subusers.isLoading ? (
          <p className="text-muted-foreground text-xs">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            No subusers yet. Invite someone above.
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
                          Save
                        </Button>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={cancelEdit}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => startEdit(row)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="xs"
                          variant="destructive"
                          disabled={deleteSubuser.isPending}
                          onClick={() => void handleDelete(row)}
                        >
                          Revoke
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
      </section>
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
              <input
                type="checkbox"
                checked={value.includes(scope)}
                onChange={() => onChange(togglePermission(value, scope))}
              />
              <span>{scope}</span>
            </label>
          ))}
        </fieldset>
      ))}
    </div>
  )
}

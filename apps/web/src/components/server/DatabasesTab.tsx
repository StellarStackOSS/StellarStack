import { useState } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardInner,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

import { ConfirmDialog } from "@/components/ConfirmDialog"
import { useServerLayout } from "@/components/ServerLayoutContext"
import {
  useAttachableHosts,
  useCreateDatabase,
  useDeleteDatabase,
  useServerDatabases,
} from "@/hooks/useDatabases"
import type { ServerDatabaseRow } from "@/hooks/useDatabases"
import { ApiFetchError } from "@/lib/ApiFetch"
import { notify } from "@/lib/notify"

export const DatabasesTab = () => {
  const { server } = useServerLayout()
  const databasesQuery = useServerDatabases(server.id)
  const deleteDb = useDeleteDatabase(server.id)
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  const databases = databasesQuery.data?.databases ?? []

  return (
    <div className="flex flex-col gap-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Databases</CardTitle>
          <CardAction>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              New database
            </Button>
          </CardAction>
        </CardHeader>
        <CardInner className="p-3">
          <p className="text-sm text-muted-foreground">
            Attach a fresh database to this server. Connection details
            show up below — copy them into your startup variables.
          </p>
        </CardInner>
      </Card>

      {databasesQuery.isLoading ? (
        <Card><CardInner className="p-4 text-xs text-muted-foreground">Loading…</CardInner></Card>
      ) : databases.length === 0 ? (
        <Card>
          <CardInner className="p-6 text-center text-xs text-muted-foreground">
            No databases yet.
          </CardInner>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {databases.map((db) => (
            <DatabaseCard
              key={db.id}
              db={db}
              onDelete={() => setDeleteTarget({ id: db.id, name: db.name })}
            />
          ))}
        </div>
      )}

      <CreateDatabaseDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        serverId={server.id}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null) }}
        title="Delete database"
        description={`Delete "${deleteTarget?.name ?? ""}"? Its data is permanently dropped.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          if (deleteTarget === null) return
          try {
            await deleteDb.mutateAsync(deleteTarget.id)
            notify.success("Database deleted")
            setDeleteTarget(null)
          } catch {
            notify.error("Failed to delete database")
          }
        }}
      />
    </div>
  )
}

const CopyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
)

const EyeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

const EyeOffIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
    <line x1="2" y1="2" x2="22" y2="22" />
  </svg>
)

const IconButton = ({
  onClick,
  label,
  children,
}: {
  onClick: () => void
  label: string
  children: React.ReactNode
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    className="flex size-7 shrink-0 items-center justify-center rounded border border-zinc-200/10 bg-zinc-900/60 text-zinc-500 transition-colors hover:border-zinc-200/20 hover:bg-zinc-900 hover:text-zinc-200"
  >
    {children}
  </button>
)

const DatabaseCard = ({
  db,
  onDelete,
}: {
  db: ServerDatabaseRow
  onDelete: () => void
}) => {
  const [showPassword, setShowPassword] = useState(false)
  const copy = (value: string, label: string) => {
    void navigator.clipboard.writeText(value)
    notify.success(`${label} copied`)
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="truncate font-mono text-xs">{db.name}</CardTitle>
        <CardDescription className="mt-1 flex items-center gap-1.5">
          <Badge variant="secondary" className="font-mono text-[0.6rem]">{db.host.dbType}</Badge>
          <span className="truncate">on {db.host.name}</span>
        </CardDescription>
        <CardAction>
          <Button size="xs" variant="destructive" onClick={onDelete}>
            Delete
          </Button>
        </CardAction>
      </CardHeader>
      <CardInner className="p-3">
        <dl className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 text-xs">
          <Field label="Address" value={db.host.address} onCopy={() => copy(db.host.address, "Address")} />
          <Field label="Database" value={db.name} onCopy={() => copy(db.name, "Database")} />
          <Field label="Username" value={db.username} onCopy={() => copy(db.username, "Username")} />
          <Field
            label="Password"
            value={showPassword ? db.password : "•".repeat(Math.min(db.password.length, 24))}
            onCopy={() => copy(db.password, "Password")}
            extra={
              <IconButton
                onClick={() => setShowPassword((v) => !v)}
                label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </IconButton>
            }
          />
          <Field
            label="URI"
            value={db.connectionString}
            onCopy={() => copy(db.connectionString, "Connection string")}
          />
        </dl>
      </CardInner>
    </Card>
  )
}

const Field = ({
  label,
  value,
  onCopy,
  extra,
}: {
  label: string
  value: string
  onCopy: () => void
  extra?: React.ReactNode
}) => (
  <>
    <dt className="text-muted-foreground text-xs">{label}</dt>
    <dd className="flex min-w-0 items-center gap-1.5">
      <code
        className="min-w-0 flex-1 truncate rounded border border-zinc-200/10 bg-zinc-900/40 px-2 py-1.5 text-xs font-mono text-zinc-300"
        title={value}
      >
        {value || "—"}
      </code>
      {extra}
      <IconButton onClick={onCopy} label={`Copy ${label.toLowerCase()}`}>
        <CopyIcon />
      </IconButton>
    </dd>
  </>
)

const CreateDatabaseDialog = ({
  open,
  onOpenChange,
  serverId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  serverId: string
}) => {
  const hostsQuery = useAttachableHosts(serverId)
  const create = useCreateDatabase(serverId)
  const [hostId, setHostId] = useState("")
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)

  const reset = () => { setHostId(""); setName(""); setError(null) }

  const submit = async () => {
    setError(null)
    if (hostId === "") {
      setError("Select a host")
      return
    }
    try {
      await create.mutateAsync({
        hostId,
        name: name.trim() === "" ? undefined : name.trim(),
      })
      notify.success("Database created")
      reset()
      onOpenChange(false)
    } catch (err) {
      setError(
        err instanceof ApiFetchError
          ? (err.body.error.code ?? "Failed to create database")
          : "Failed to create database"
      )
    }
  }

  const hosts = hostsQuery.data?.hosts ?? []

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New database</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Host</Label>
            <Select value={hostId} onValueChange={setHostId}>
              <SelectTrigger>
                <SelectValue placeholder={hosts.length === 0 ? "No hosts available" : "Select a database host"} />
              </SelectTrigger>
              <SelectContent>
                {hosts.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.name} ({h.dbType})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Name (optional)</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
              placeholder="my_app_db"
            />
            <p className="text-[0.6rem] text-muted-foreground">
              Letters, numbers, and underscores only. A name will be auto-generated if you leave this empty.
            </p>
          </div>
          {error !== null && <p className="text-destructive text-xs">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" disabled={create.isPending || hosts.length === 0} onClick={() => void submit()}>
            {create.isPending ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

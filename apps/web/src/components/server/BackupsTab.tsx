import { useState } from "react"

import { Button } from "@workspace/ui/components/button"

import {
  useBackupDestination,
  useBackups,
  useCreateBackup,
  useDeleteBackup,
  useDeleteBackupDestination,
  useLockBackup,
  useRestoreBackup,
  useUpsertBackupDestination,
} from "@/hooks/useBackups"
import type { BackupRow } from "@/hooks/useBackups.types"
import { useServerLayout } from "@/components/ServerLayoutContext"

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}

const stateBadge: Record<BackupRow["state"], string> = {
  pending: "bg-chart-2 animate-pulse",
  ready: "bg-chart-1",
  failed: "bg-destructive",
}

const initialDest = {
  endpoint: "http://localhost:9000",
  region: "us-east-1",
  bucket: "stellar-backups",
  prefix: "",
  accessKeyId: "stellar",
  secretAccessKey: "stellarstellar",
  forcePathStyle: true,
}

/**
 * `/servers/$id/backups` — take, restore, lock, delete archives. The
 * destination form configures the per-server S3 target; without one,
 * backups remain on the daemon's local disk.
 */
export const BackupsTab = () => {
  const { server } = useServerLayout()
  const backups = useBackups(server.id)
  const destinationQuery = useBackupDestination(server.id)
  const createBackup = useCreateBackup(server.id)
  const restoreBackup = useRestoreBackup(server.id)
  const deleteBackup = useDeleteBackup(server.id)
  const lockBackup = useLockBackup(server.id)
  const upsertDestination = useUpsertBackupDestination(server.id)
  const deleteDestination = useDeleteBackupDestination(server.id)

  const [name, setName] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [destOpen, setDestOpen] = useState(false)
  const [destForm, setDestForm] = useState(initialDest)

  const destination = destinationQuery.data?.destination ?? null
  const rows = backups.data?.backups ?? []
  const hasS3 = destination !== null

  const handleTake = async (storage: "local" | "s3") => {
    setErrorMessage(null)
    const fallback = `backup-${new Date().toISOString().replace(/[:.]/g, "-")}`
    const trimmed = name.trim().length > 0 ? name.trim() : fallback
    try {
      await createBackup.mutateAsync({
        name: trimmed,
        ...(storage === "s3" && destination !== null
          ? { destinationId: destination.id }
          : {}),
      })
      setName("")
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err))
    }
  }

  const handleRestore = async (row: BackupRow) => {
    if (
      !window.confirm(
        `Restore "${row.name}"? The server will be killed and its files replaced.`
      )
    ) {
      return
    }
    try {
      await restoreBackup.mutateAsync(row.id)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err))
    }
  }

  const handleDelete = async (row: BackupRow) => {
    if (row.locked) {
      return
    }
    if (!window.confirm(`Delete backup "${row.name}"?`)) {
      return
    }
    try {
      await deleteBackup.mutateAsync(row.id)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err))
    }
  }

  const handleSaveDestination = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    try {
      await upsertDestination.mutateAsync(destForm)
      setDestOpen(false)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-base font-semibold">Backups</h1>
        <p className="text-muted-foreground text-xs">
          Archive the server's bind-mount and restore on demand. Stores
          locally on the node, or pushes to an S3-compatible bucket.
        </p>
      </header>

      <section className="border-border bg-card text-card-foreground flex flex-col gap-3 rounded-md border p-4">
        <header className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Take a backup</h2>
        </header>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Optional name (timestamp if blank)"
            className="border-border bg-background h-8 flex-1 min-w-[16rem] rounded-md border px-2 text-xs"
          />
          <Button
            size="sm"
            onClick={() => handleTake("local")}
            disabled={createBackup.isPending}
          >
            Take local
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!hasS3 || createBackup.isPending}
            onClick={() => handleTake("s3")}
            title={hasS3 ? undefined : "Configure an S3 destination first"}
          >
            Take to S3
          </Button>
        </div>
        {errorMessage !== null ? (
          <p className="text-destructive text-xs" role="alert">
            {errorMessage}
          </p>
        ) : null}
      </section>

      <section className="border-border bg-card text-card-foreground rounded-md border p-4">
        <header className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium">Archives</h2>
          <span className="text-muted-foreground text-xs">
            {rows.length} backup{rows.length === 1 ? "" : "s"}
          </span>
        </header>
        {backups.isLoading ? (
          <p className="text-muted-foreground text-xs">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            No backups yet. Take one above.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className="border-border flex flex-col gap-1 rounded border px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`size-1.5 rounded-full ${stateBadge[row.state]}`}
                    />
                    <span className="truncate font-medium">{row.name}</span>
                    <span className="text-muted-foreground uppercase">
                      {row.storage}
                    </span>
                    {row.locked ? (
                      <span className="bg-muted rounded px-1 py-0.5 text-[0.6rem] uppercase">
                        locked
                      </span>
                    ) : null}
                  </div>
                  <div className="text-muted-foreground mt-1 truncate">
                    {row.state === "ready"
                      ? `${formatBytes(row.bytes)} · ${row.completedAt ?? ""}`
                      : row.state === "pending"
                        ? "archiving…"
                        : `failed: ${row.failureCode ?? "unknown"}`}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() =>
                      lockBackup.mutate({
                        backupId: row.id,
                        locked: !row.locked,
                      })
                    }
                  >
                    {row.locked ? "Unlock" : "Lock"}
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={
                      row.state !== "ready" || restoreBackup.isPending
                    }
                    onClick={() => handleRestore(row)}
                  >
                    Restore
                  </Button>
                  <Button
                    size="xs"
                    variant="destructive"
                    disabled={row.locked || deleteBackup.isPending}
                    onClick={() => handleDelete(row)}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border-border bg-card text-card-foreground rounded-md border p-4">
        <header className="mb-2 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium">S3 destination</h2>
            <p className="text-muted-foreground text-xs">
              {hasS3
                ? `${destination?.endpoint} · ${destination?.bucket}/${destination?.prefix}`
                : "No S3 destination — backups stay on the daemon's local disk."}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="xs"
              variant="outline"
              onClick={() => {
                if (destination !== null) {
                  setDestForm({
                    endpoint: destination.endpoint,
                    region: destination.region,
                    bucket: destination.bucket,
                    prefix: destination.prefix,
                    accessKeyId: destination.accessKeyId,
                    secretAccessKey: "",
                    forcePathStyle: destination.forcePathStyle,
                  })
                }
                setDestOpen((open) => !open)
              }}
            >
              {destOpen ? "Close" : hasS3 ? "Edit" : "Configure"}
            </Button>
            {hasS3 ? (
              <Button
                size="xs"
                variant="destructive"
                disabled={deleteDestination.isPending}
                onClick={() => {
                  if (window.confirm("Drop the S3 destination?")) {
                    void deleteDestination.mutateAsync()
                  }
                }}
              >
                Remove
              </Button>
            ) : null}
          </div>
        </header>
        {destOpen ? (
          <form
            className="grid grid-cols-1 gap-2 sm:grid-cols-2"
            onSubmit={handleSaveDestination}
          >
            {(
              [
                ["endpoint", "Endpoint"],
                ["region", "Region"],
                ["bucket", "Bucket"],
                ["prefix", "Prefix (optional)"],
                ["accessKeyId", "Access key ID"],
                ["secretAccessKey", "Secret access key"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex flex-col gap-1 text-xs">
                <span>{label}</span>
                <input
                  type={key === "secretAccessKey" ? "password" : "text"}
                  value={destForm[key]}
                  onChange={(e) =>
                    setDestForm({ ...destForm, [key]: e.target.value })
                  }
                  required={key !== "prefix"}
                  className="border-border bg-background h-8 rounded-md border px-2"
                />
              </label>
            ))}
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={destForm.forcePathStyle}
                onChange={(e) =>
                  setDestForm({ ...destForm, forcePathStyle: e.target.checked })
                }
              />
              <span>Force path-style (required for MinIO)</span>
            </label>
            <div className="col-span-full flex justify-end">
              <Button
                size="sm"
                type="submit"
                disabled={upsertDestination.isPending}
              >
                {hasS3 ? "Save changes" : "Save destination"}
              </Button>
            </div>
          </form>
        ) : null}
      </section>
    </div>
  )
}

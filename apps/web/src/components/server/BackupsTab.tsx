import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardAction,
  CardHeader,
  CardInner,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import { ApiFetchError } from "@/lib/ApiFetch"
import { translateApiError } from "@/lib/TranslateError"
import {
  useBackups,
  useCreateBackup,
  useDeleteBackup,
  useDownloadBackup,
  useLockBackup,
  useRestoreBackup,
} from "@/hooks/useBackups"
import type { BackupRow } from "@/hooks/useBackups.types"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { Icon } from "@/components/Icon"
import { RestoreBackupDialog } from "@/components/RestoreBackupDialog"
import { useServerLayout } from "@/components/ServerLayoutContext"

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}

const stateBadgeClass: Record<BackupRow["state"], string> = {
  pending: "bg-chart-2 animate-pulse",
  ready: "bg-chart-1",
  failed: "bg-destructive",
}

export const BackupsTab = () => {
  const { t } = useTranslation()
  const { server } = useServerLayout()
  const backups = useBackups(server.id)
  const createBackup = useCreateBackup(server.id)
  const restoreBackup = useRestoreBackup(server.id)
  const deleteBackup = useDeleteBackup(server.id)
  const lockBackup = useLockBackup(server.id)
  const downloadBackup = useDownloadBackup(server.id)

  const [name, setName] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [confirmRestore, setConfirmRestore] = useState<BackupRow | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<BackupRow | null>(null)

  const rows = backups.data?.backups ?? []
  const isRunning = rows.some((r) => r.state === "pending")
  const atLimit = rows.length >= server.backupLimit

  const handleTake = async () => {
    setErrorMessage(null)
    const fallback = `backup-${new Date().toISOString().replace(/[:.]/g, "-")}`
    const trimmed = name.trim().length > 0 ? name.trim() : fallback
    try {
      await createBackup.mutateAsync({ name: trimmed })
      setName("")
      setCreateOpen(false)
    } catch (err) {
      if (err instanceof ApiFetchError) {
        setErrorMessage(translateApiError(t, err.body.error))
      } else {
        setErrorMessage(t("internal.unexpected", { ns: "errors" }))
      }
    }
  }

  const columns = useMemo<ColumnDef<BackupRow>[]>(
    () => [
      {
        id: "name",
        header: t("backups.col.name"),
        cell: ({ row }) => (
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`size-1.5 shrink-0 rounded-full ${stateBadgeClass[row.original.state]}`}
            />
            <span className="truncate text-xs font-medium">{row.original.name}</span>
            {row.original.locked ? (
              <span className="bg-muted rounded px-1 py-0.5 text-[0.6rem] uppercase shrink-0">
                {t("backups.locked_badge")}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        id: "storage",
        header: t("backups.col.storage"),
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs uppercase">
            {row.original.storage}
          </span>
        ),
      },
      {
        id: "size",
        header: t("backups.col.size"),
        cell: ({ row }) => (
          <span className="text-xs">
            {row.original.state === "ready"
              ? formatBytes(row.original.bytes)
              : row.original.state === "pending"
                ? t("backups.state.archiving")
                : t("backups.state.failed", { code: row.original.failureCode ?? "unknown" })}
          </span>
        ),
      },
      {
        id: "created",
        header: t("backups.col.created"),
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">
            {row.original.completedAt ?? row.original.createdAt}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const r = row.original
          const canDownload = r.state === "ready" && r.storage === "local"
          const canRestore = r.state === "ready" && !restoreBackup.isPending
          const canDelete =
            !r.locked && r.state !== "pending" && !deleteBackup.isPending
          const canToggleLock = r.state !== "pending" && !lockBackup.isPending
          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon-sm" variant="ghost" className="size-7">
                    <Icon name="more-horizontal" className="size-3.5" />
                    <span className="sr-only">Actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[10rem]">
                  <DropdownMenuItem
                    disabled={!canToggleLock}
                    onClick={() =>
                      lockBackup.mutate({ backupId: r.id, locked: !r.locked })
                    }
                  >
                    {r.locked ? t("backups.unlock") : t("backups.lock")}
                  </DropdownMenuItem>
                  {canDownload ? (
                    <DropdownMenuItem onClick={() => void downloadBackup(r.name)}>
                      {t("backups.download")}
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem
                    disabled={!canRestore}
                    onClick={() => setConfirmRestore(r)}
                  >
                    {t("backups.restore")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    disabled={!canDelete}
                    onClick={() => setConfirmDelete(r)}
                  >
                    {t("backups.delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        },
      },
    ],
    [t, lockBackup, downloadBackup, restoreBackup.isPending, deleteBackup.isPending, server.status]
  )

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="flex flex-col gap-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{t("backups.title")}</CardTitle>
        </CardHeader>
        <CardInner className="p-3">
          <p className="text-sm text-muted-foreground">{t("backups.description")}</p>
        </CardInner>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("backups.archives_heading")}</CardTitle>
          <CardAction>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs">
                {rows.length}/{server.backupLimit}
              </span>
              <Button
                size="sm"
                onClick={() => { setErrorMessage(null); setCreateOpen(true) }}
                disabled={atLimit || isRunning}
                title={
                  isRunning
                    ? t("backups.already_running", {
                        defaultValue: "A backup is already running",
                      })
                    : undefined
                }
              >
                {t("backups.create", { defaultValue: "Create" })}
              </Button>
            </div>
          </CardAction>
        </CardHeader>
        <CardInner className="p-3">
          {backups.isLoading ? (
            <p className="text-muted-foreground text-xs">{t("backups.loading")}</p>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground text-xs">{t("backups.empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id}>
                    {hg.headers.map((header) => (
                      <TableHead key={header.id}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          </CardInner>
      </Card>

      <RestoreBackupDialog
        open={confirmRestore !== null}
        onOpenChange={(open) => { if (!open) setConfirmRestore(null) }}
        backupName={confirmRestore?.name ?? ""}
        onConfirm={async (snapshotBeforeRestore) => {
          if (confirmRestore === null) return
          await restoreBackup.mutateAsync({
            backupId: confirmRestore.id,
            snapshotBeforeRestore,
          })
        }}
      />

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null) }}
        title={t("backups.confirm.delete_title")}
        description={t("backups.confirm.delete_description", { name: confirmDelete?.name ?? "" })}
        confirmLabel={t("backups.delete")}
        variant="destructive"
        onConfirm={async () => {
          if (confirmDelete === null) return
          try {
            await deleteBackup.mutateAsync(confirmDelete.id)
          } catch (err) {
            if (err instanceof ApiFetchError) {
              setErrorMessage(translateApiError(t, err.body.error))
            } else {
              setErrorMessage(t("internal.unexpected", { ns: "errors" }))
            }
          }
        }}
      />

      <Dialog
        open={createOpen}
        onOpenChange={(v) => {
          setCreateOpen(v)
          if (!v) { setName(""); setErrorMessage(null) }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {t("backups.take_heading", { defaultValue: "Take a backup" })}
            </DialogTitle>
            <DialogDescription>
              {t("backups.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">
              {t("backups.name_label", { defaultValue: "Name (optional)" })}
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("backups.name_placeholder")}
              autoFocus
            />
          </div>
          {errorMessage !== null ? (
            <p className="text-destructive text-xs" role="alert">
              {errorMessage}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
              {t("actions.cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button
              size="sm"
              disabled={createBackup.isPending}
              onClick={() => void handleTake()}
            >
              {createBackup.isPending
                ? t("backups.creating", { defaultValue: "Creating…" })
                : t("backups.create", { defaultValue: "Create" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

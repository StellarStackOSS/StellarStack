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
import { Input } from "@workspace/ui/components/input"
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [confirmRestore, setConfirmRestore] = useState<BackupRow | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<BackupRow | null>(null)

  const rows = backups.data?.backups ?? []

  const handleTake = async () => {
    setErrorMessage(null)
    const fallback = `backup-${new Date().toISOString().replace(/[:.]/g, "-")}`
    const trimmed = name.trim().length > 0 ? name.trim() : fallback
    try {
      await createBackup.mutateAsync({ name: trimmed })
      setName("")
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
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            <Button
              size="xs"
              variant="outline"
              onClick={() =>
                lockBackup.mutate({ backupId: row.original.id, locked: !row.original.locked })
              }
            >
              {row.original.locked ? t("backups.unlock") : t("backups.lock")}
            </Button>
            {row.original.state === "ready" && row.original.storage === "local" ? (
              <Button
                size="xs"
                variant="outline"
                onClick={() => void downloadBackup(row.original.name)}
              >
                {t("backups.download")}
              </Button>
            ) : null}
            <Button
              size="xs"
              variant="outline"
              disabled={
                row.original.state !== "ready" ||
                restoreBackup.isPending ||
                false
              }
              onClick={() => setConfirmRestore(row.original)}
            >
              {t("backups.restore")}
            </Button>
            <Button
              size="xs"
              variant="destructive"
              disabled={row.original.locked || deleteBackup.isPending}
              onClick={() => setConfirmDelete(row.original)}
            >
              {t("backups.delete")}
            </Button>
          </div>
        ),
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
          <CardTitle>{t("backups.take_heading")}</CardTitle>
        </CardHeader>
        <CardInner className="p-3 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("backups.name_placeholder")}
              className="flex-1 min-w-[16rem] text-xs"
            />
            <Button
              size="sm"
              onClick={() => void handleTake()}
              disabled={createBackup.isPending}
            >
              {t("backups.take_local")}
            </Button>
          </div>
          {errorMessage !== null ? (
            <p className="text-destructive text-xs" role="alert">
              {errorMessage}
            </p>
          ) : null}
          </CardInner>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("backups.archives_heading")}</CardTitle>
          <CardAction>
            <span className="text-muted-foreground text-xs">
              {t(
                rows.length === 1 ? "backups.count_one" : "backups.count_other",
                { count: rows.length }
              )}
            </span>
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
    </div>
  )
}

import { useState, useMemo } from "react"
import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon } from "@hugeicons/core-free-icons"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Input } from "@workspace/ui/components/input"
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { blueprintSchema } from "@workspace/shared/blueprint"
import type { Blueprint } from "@workspace/shared/blueprint.types"

import { ApiFetchError } from "@/lib/ApiFetch"
import { translateApiError } from "@/lib/TranslateError"
import {
  useBlueprints,
  useUpdateBlueprint,
  useDeleteBlueprint,
} from "@/hooks/useBlueprints"
import type { BlueprintListRow } from "@/hooks/useBlueprints.types"

const stringifyName = (name: BlueprintListRow["name"]): string =>
  typeof name === "string" ? name : `[${(name as { key: string }).key}]`

const blueprintRowToBlueprint = (row: BlueprintListRow): Blueprint => ({
  schemaVersion: 1,
  name: row.name,
  description: row.description,
  author: row.author,
  dockerImages: row.dockerImages,
  stopSignal: row.stopSignal,
  startupCommand: row.startupCommand,
  configFiles: row.configFiles,
  variables: row.variables,
  install: {
    image: row.installImage,
    entrypoint: row.installEntrypoint,
    script: row.installScript,
  },
  lifecycle: row.lifecycle,
  features: row.features,
})

const blankBlueprint: Blueprint = {
  schemaVersion: 1,
  name: "New blueprint",
  dockerImages: { Default: "ghcr.io/example/server:latest" },
  stopSignal: "SIGTERM",
  startupCommand: "./run.sh",
  variables: [],
  install: {
    image: "ghcr.io/stellarstack/installers:debian",
    entrypoint: "bash",
    script: "#!/usr/bin/env bash\nset -euo pipefail\n",
  },
  lifecycle: {
    starting: {
      probes: [{ strategy: "tcp", port: "{{SERVER_PORT}}" }],
      intervalMs: 2000,
      timeoutMs: 60_000,
      onTimeout: "mark_crashed",
    },
    stopping: {
      probes: [{ strategy: "container_exit" }],
      graceTimeoutMs: 30_000,
      onTimeout: "force_kill",
    },
    crashDetection: {
      probes: [{ strategy: "container_exit", ifNotInState: ["stopping", "stopped"] }],
    },
  },
}

const BlueprintEditorSheet = ({
  row,
  onClose,
}: {
  row: BlueprintListRow
  onClose: () => void
}) => {
  const { t } = useTranslation()
  const updateMutation = useUpdateBlueprint()

  const [draftJson, setDraftJson] = useState(() =>
    JSON.stringify(blueprintRowToBlueprint(row), null, 2)
  )
  const [errors, setErrors] = useState<string[]>([])
  const [saveError, setSaveError] = useState<string | null>(null)

  const parseDraft = (): Blueprint | null => {
    let raw: unknown
    try {
      raw = JSON.parse(draftJson)
    } catch {
      setErrors([t("blueprints.parse.invalid_json", { ns: "errors" })])
      return null
    }
    const result = blueprintSchema.safeParse(raw)
    if (!result.success) {
      setErrors(result.error.issues.map((issue) =>
        `${issue.path.length === 0 ? "(root)" : issue.path.join(".")}: ${issue.message}`
      ))
      return null
    }
    setErrors([])
    return result.data
  }

  const handleSave = async () => {
    setSaveError(null)
    const parsed = parseDraft()
    if (parsed === null) return
    try {
      await updateMutation.mutateAsync({ id: row.id, body: parsed })
      onClose()
    } catch (err) {
      if (err instanceof ApiFetchError) {
        const fields = err.body.error.fields
        if (fields !== undefined && fields.length > 0) {
          setErrors(fields.map((field) =>
            `${field.path}: ${t(field.code, { ns: "validation", defaultValue: field.code, ...(field.params ?? {}) })}`
          ))
          return
        }
        setSaveError(translateApiError(t, err.body.error))
        return
      }
      setSaveError(t("internal.unexpected", { ns: "errors" }))
    }
  }

  const isPending = updateMutation.isPending

  return (
    <Sheet open onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent side="right" className="w-full max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("blueprints.edit_title")}</SheetTitle>
          <SheetDescription>{stringifyName(row.name)}</SheetDescription>
        </SheetHeader>
        <SheetBody>
          <textarea
            value={draftJson}
            onChange={(e) => setDraftJson(e.target.value)}
            spellCheck={false}
            className="border-border bg-background min-h-[32rem] w-full rounded-md border p-3 font-mono text-xs"
          />
          {errors.length > 0 && (
            <div className="border-destructive bg-destructive/10 text-destructive rounded border px-3 py-2 text-xs" role="alert">
              <p className="mb-1 font-medium">{t("blueprints.schema_errors_heading")}</p>
              <ul className="list-disc space-y-0.5 pl-4">
                {errors.map((message, index) => <li key={index}>{message}</li>)}
              </ul>
            </div>
          )}
          {saveError !== null && (
            <p className="text-destructive text-xs" role="alert">{saveError}</p>
          )}
          <div className="flex justify-end">
            <Button size="sm" onClick={() => void handleSave()} disabled={isPending}>
              {isPending ? t("settings.saving") : t("blueprints.save_changes")}
            </Button>
          </div>
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}

const DeleteBlueprintDialog = ({
  row,
  onClose,
}: {
  row: BlueprintListRow
  onClose: () => void
}) => {
  const { t } = useTranslation()
  const deleteMutation = useDeleteBlueprint()
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setError(null)
    try {
      await deleteMutation.mutateAsync(row.id)
      onClose()
    } catch (err) {
      setError(
        err instanceof ApiFetchError
          ? translateApiError(t, err.body.error)
          : t("internal.unexpected", { ns: "errors" })
      )
    }
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("blueprints.delete_button")}</DialogTitle>
          <DialogDescription>{t("blueprints.confirm_delete")}</DialogDescription>
        </DialogHeader>
        {error !== null && <p className="text-destructive text-xs" role="alert">{error}</p>}
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>{t("actions.cancel")}</Button>
          <Button variant="destructive" size="sm" disabled={deleteMutation.isPending} onClick={() => void handleDelete()}>
            {deleteMutation.isPending ? "Deleting…" : t("actions.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export const AdminBlueprintsPage = () => {
  const { t } = useTranslation()
  const { data, isLoading } = useBlueprints()

  const [globalFilter, setGlobalFilter] = useState("")
  const [sorting, setSorting] = useState<SortingState>([{ id: "name", desc: false }])
  const [editorRow, setEditorRow] = useState<BlueprintListRow | null>(null)
  const [deleteRow, setDeleteRow] = useState<BlueprintListRow | null>(null)

  const blueprints = data?.blueprints ?? []

  const columns = useMemo<ColumnDef<BlueprintListRow>[]>(
    () => [
      {
        id: "name",
        accessorFn: (r) => stringifyName(r.name),
        header: t("nodes.col.name"),
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{stringifyName(row.original.name)}</p>
            {row.original.description !== undefined && row.original.description !== null && (
              <p className="text-muted-foreground text-xs">{String(row.original.description)}</p>
            )}
          </div>
        ),
        filterFn: "includesString",
      },
      {
        id: "images",
        header: "Docker images",
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">
            {Object.keys(row.original.dockerImages as Record<string, string>).join(", ")}
          </span>
        ),
        enableSorting: false,
      },
      {
        id: "variables",
        header: "Variables",
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">
            {(row.original.variables as unknown[]).length}
          </span>
        ),
        enableSorting: false,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={(e) => e.stopPropagation()}
              >
                ···
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditorRow(row.original)}>
                {t("blueprints.edit_title")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={(e) => { e.stopPropagation(); setDeleteRow(row.original) }}
              >
                {t("blueprints.delete_button")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        enableSorting: false,
        enableGlobalFilter: false,
      },
    ],
    [t]
  )

  const table = useReactTable({
    data: blueprints,
    columns,
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    globalFilterFn: "includesString",
    getRowId: (row) => row.id,
  })

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-base font-semibold">{t("blueprints.title")}</h1>
          <p className="text-muted-foreground text-xs">{t("blueprints.description")}</p>
        </div>
        <Button size="sm" asChild>
          <Link to="/admin/create-blueprint">{t("blueprints.new_button")}</Link>
        </Button>
      </header>

      <div className="relative max-w-sm">
        <HugeiconsIcon icon={Search01Icon} size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t("audit.search_placeholder")}
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="pl-8 text-sm h-8"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-6 text-center text-muted-foreground text-sm">
                  {t("blueprints.loading")}
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-6 text-center text-muted-foreground text-sm">
                  {t("blueprints.empty")}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="cursor-pointer" onClick={() => setEditorRow(row.original)}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {editorRow !== null && (
        <BlueprintEditorSheet
          row={editorRow}
          onClose={() => setEditorRow(null)}
        />
      )}
      {deleteRow !== null && (
        <DeleteBlueprintDialog row={deleteRow} onClose={() => setDeleteRow(null)} />
      )}
    </div>
  )
}

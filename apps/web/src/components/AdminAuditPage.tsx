import { useMemo, useState } from "react"
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
import { ArrowDown01Icon, ArrowUp01Icon, Search01Icon } from "@hugeicons/core-free-icons"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Sheet,
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

import { useAdminAudit } from "@/hooks/useAdminAudit"
import type { AuditEntry } from "@/hooks/useAdminAudit.types"

const PAGE_SIZE = 50

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })

const DetailRow = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div className="space-y-1">
    <p className="text-xs font-medium text-muted-foreground">{label}</p>
    <p className={mono ? "font-mono text-xs break-all" : "text-sm"}>{value}</p>
  </div>
)

const DetailSheet = ({
  entry,
  open,
  onClose,
}: {
  entry: AuditEntry | null
  open: boolean
  onClose: () => void
}) => {
  const { t } = useTranslation()
  if (entry === null) return null

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("audit.detail_title")}</SheetTitle>
          <SheetDescription className="font-mono text-xs">{entry.action}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-6 pb-8">
          <DetailRow label={t("audit.field.time")} value={formatDate(entry.createdAt)} />
          <DetailRow label={t("audit.field.action")} value={entry.action} mono />
          <DetailRow label={t("audit.field.actor")} value={entry.actorId ?? "—"} mono />
          <DetailRow label={t("audit.field.ip")} value={entry.ip ?? "—"} mono />
          {entry.targetType !== null && entry.targetId !== null && (
            <DetailRow
              label={t("audit.field.target")}
              value={`${entry.targetType}: ${entry.targetId}`}
              mono
            />
          )}
          {entry.metadata !== null && Object.keys(entry.metadata).length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">{t("audit.field.metadata")}</p>
              <div className="rounded-md border bg-muted/30 p-3">
                <pre className="whitespace-pre-wrap break-all font-mono text-xs">
                  {JSON.stringify(entry.metadata, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

const SortableHeader = ({
  label,
  colId,
  sorting,
  onSort,
}: {
  label: string
  colId: string
  sorting: SortingState
  onSort: (colId: string) => void
}) => {
  const active = sorting[0]?.id === colId
  const desc = sorting[0]?.desc ?? false
  return (
    <button
      className="flex items-center gap-1 text-left font-medium text-muted-foreground hover:text-foreground transition-colors"
      onClick={() => onSort(colId)}
    >
      {label}
      {active && (
        <HugeiconsIcon
          icon={desc ? ArrowDown01Icon : ArrowUp01Icon}
          size={12}
          className="shrink-0"
        />
      )}
    </button>
  )
}

export const AdminAuditPage = () => {
  const { t } = useTranslation()
  const [offset, setOffset] = useState(0)
  const [actionFilter, setActionFilter] = useState("")
  const [globalFilter, setGlobalFilter] = useState("")
  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }])
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const { data, isLoading } = useAdminAudit({
    limit: PAGE_SIZE,
    offset,
    action: actionFilter || undefined,
  })

  const entries = data?.entries ?? []

  const columns = useMemo<ColumnDef<AuditEntry>[]>(
    () => [
      {
        id: "createdAt",
        accessorKey: "createdAt",
        header: t("audit.col.time"),
        cell: ({ row }) => (
          <span className="tabular-nums text-xs text-muted-foreground whitespace-nowrap">
            {formatDate(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: "action",
        accessorKey: "action",
        header: t("audit.col.action"),
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.action}</span>
        ),
        filterFn: "includesString",
      },
      {
        id: "actor",
        accessorKey: "actorId",
        header: t("audit.col.actor"),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.actorId?.slice(0, 8) ?? "—"}
          </span>
        ),
        filterFn: "includesString",
      },
      {
        id: "target",
        accessorFn: (e) =>
          e.targetType !== null && e.targetId !== null
            ? `${e.targetType}:${e.targetId}`
            : "",
        header: t("audit.col.target"),
        cell: ({ row }) => {
          const e = row.original
          if (e.targetType === null || e.targetId === null) {
            return <span className="text-muted-foreground text-xs">—</span>
          }
          return (
            <span className="text-xs text-muted-foreground">
              {e.targetType}:{e.targetId.slice(0, 8)}
            </span>
          )
        },
        filterFn: "includesString",
      },
      {
        id: "ip",
        accessorKey: "ip",
        header: t("audit.col.ip"),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.ip ?? "—"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={(e) => {
              e.stopPropagation()
              setSelectedEntry(row.original)
              setSheetOpen(true)
            }}
          >
            {t("audit.view")}
          </Button>
        ),
        enableSorting: false,
        enableGlobalFilter: false,
      },
    ],
    [t]
  )

  const table = useReactTable({
    data: entries,
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

  const handleSortToggle = (colId: string) => {
    setSorting((prev) => {
      if (prev[0]?.id === colId) return [{ id: colId, desc: !prev[0].desc }]
      return [{ id: colId, desc: false }]
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-base font-semibold">{t("audit.title")}</h1>
        <p className="text-muted-foreground text-xs">{t("audit.description")}</p>
      </header>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <HugeiconsIcon
            icon={Search01Icon}
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder={t("audit.search_placeholder")}
            value={globalFilter}
            onChange={(e) => {
              setGlobalFilter(e.target.value)
              setOffset(0)
            }}
            className="pl-8 text-sm h-8"
          />
        </div>
        <Input
          placeholder={t("audit.action_filter_placeholder")}
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value)
            setOffset(0)
          }}
          className="max-w-48 text-sm h-8 font-mono"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <SortableHeader
                        label={String(flexRender(header.column.columnDef.header, header.getContext()))}
                        colId={header.column.id}
                        sorting={sorting}
                        onSort={handleSortToggle}
                      />
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-6 text-center text-muted-foreground text-sm">
                  {t("audit.loading")}
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-6 text-center text-muted-foreground text-sm">
                  {t("audit.empty")}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => {
                    setSelectedEntry(row.original)
                    setSheetOpen(true)
                  }}
                >
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

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          disabled={offset === 0}
          onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
        >
          {t("audit.prev")}
        </Button>
        <span className="text-sm text-muted-foreground">
          {t("audit.pagination", { from: offset + 1, to: offset + entries.length })}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={entries.length < PAGE_SIZE}
          onClick={() => setOffset(offset + PAGE_SIZE)}
        >
          {t("audit.next")}
        </Button>
      </div>

      <DetailSheet
        entry={selectedEntry}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </div>
  )
}

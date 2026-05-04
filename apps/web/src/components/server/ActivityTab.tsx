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
  CardContent,
  CardHeader,
  CardInner,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import { useServerLayout } from "@/components/ServerLayoutContext"
import { useServerActivity } from "@/hooks/useServerActivity"
import type { ActivityEntry } from "@/hooks/useServerActivity.types"

const PAGE_SIZE = 25

export const ActivityTab = () => {
  const { t } = useTranslation()
  const { server } = useServerLayout()
  const [offset, setOffset] = useState(0)
  const { data, isLoading } = useServerActivity(server.id, offset)
  const entries: ActivityEntry[] = useMemo(() => data?.entries ?? [], [data])

  const columns = useMemo<ColumnDef<ActivityEntry>[]>(
    () => [
      {
        id: "action",
        header: t("activity.column.action", { defaultValue: "Action" }),
        cell: ({ row }) => {
          const code = row.original.action
          const label = t(`audit.${code}`, {
            defaultValue: code,
            ns: "common",
          })
          return <span className="text-zinc-200 text-xs">{label}</span>
        },
      },
      {
        id: "actor",
        header: t("activity.column.actor", { defaultValue: "Actor" }),
        cell: ({ row }) =>
          row.original.actorId !== null ? (
            <span className="text-muted-foreground font-mono text-[0.7rem]">
              {row.original.actorId.slice(0, 8)}…
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          ),
      },
      {
        id: "metadata",
        header: t("activity.column.metadata", { defaultValue: "Metadata" }),
        cell: ({ row }) =>
          row.original.metadata !== null ? (
            <span className="text-muted-foreground text-xs">
              {Object.entries(row.original.metadata)
                .map(([k, v]) => `${k}=${String(v)}`)
                .join(" · ")}
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          ),
      },
      {
        id: "createdAt",
        header: t("activity.column.when", { defaultValue: "When" }),
        cell: ({ row }) => (
          <span className="text-muted-foreground font-mono text-[0.7rem]">
            {new Date(row.original.createdAt).toLocaleString()}
          </span>
        ),
      },
    ],
    [t]
  )

  const table = useReactTable({
    data: entries,
    columns,
    getCoreRowModel: getCoreRowModel(),
    // Server-driven pagination: the API takes offset+limit, so we
    // skip TanStack's client paginator and drive the cursor with
    // local state. PAGE_SIZE matches the limit the hook sends.
  })

  const totalPages = Math.max(
    1,
    Math.ceil((data?.total ?? 0) / PAGE_SIZE)
  )
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{t("activity.title")}</CardTitle>
        </CardHeader>
        <CardInner className="p-3">
          <p className="text-sm text-muted-foreground">
            {t("activity.description")}
          </p>
        </CardInner>
      </Card>

      <Card className="flex min-h-0 w-full flex-1 flex-col">
        <CardHeader>
          <CardTitle>{t("activity.history_heading")}</CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col">
          <CardInner className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden p-0">
        <div className="min-h-0 flex-1 overflow-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id} className="hover:bg-transparent">
                  {hg.headers.map((h) => (
                    <TableHead key={h.id} className="text-xs h-9">
                      {h.isPlaceholder
                        ? null
                        : flexRender(
                            h.column.columnDef.header,
                            h.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="text-muted-foreground text-xs"
                  >
                    {t("activity.loading")}
                  </TableCell>
                </TableRow>
              ) : table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="text-muted-foreground text-xs"
                  >
                    {t("activity.empty")}
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination strip pinned to the bottom of the card */}
        <div className="flex shrink-0 items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground">
          <span>
            {entries.length === 0 ? 0 : offset + 1}–
            {offset + entries.length} of {data?.total ?? entries.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              size="xs"
              variant="ghost"
              disabled={offset === 0}
              onClick={() =>
                setOffset((prev) => Math.max(0, prev - PAGE_SIZE))
              }
            >
              ‹ Prev
            </Button>
            <span className="px-1">
              {currentPage} / {totalPages}
            </span>
            <Button
              size="xs"
              variant="ghost"
              disabled={
                data?.total !== undefined
                  ? offset + entries.length >= data.total
                  : entries.length < PAGE_SIZE
              }
              onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
            >
              Next ›
            </Button>
          </div>
        </div>
          </CardInner>
        </CardContent>
      </Card>
    </div>
  )
}

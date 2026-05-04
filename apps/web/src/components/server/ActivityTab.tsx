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

  return (
    <div className="flex flex-col gap-4">
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

      <Card>
        <CardHeader>
          <CardTitle>{t("activity.history_heading")}</CardTitle>
        </CardHeader>
        <CardInner className="p-3 flex flex-col gap-3">
          <div className="overflow-x-auto rounded border border-border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id}>
                    {hg.headers.map((h) => (
                      <TableHead key={h.id} className="text-xs">
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

          <div className="flex items-center justify-between pt-1">
            <span className="text-muted-foreground text-xs">
              {t("activity.pagination", {
                from: entries.length === 0 ? 0 : offset + 1,
                to: offset + entries.length,
              })}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={offset === 0}
                onClick={() =>
                  setOffset((prev) => Math.max(0, prev - PAGE_SIZE))
                }
              >
                {t("activity.prev")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={entries.length < PAGE_SIZE}
                onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
              >
                {t("activity.next")}
              </Button>
            </div>
          </div>
        </CardInner>
      </Card>
    </div>
  )
}

import { useMemo } from "react"
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
  CardDescription,
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

import { ApiFetchError } from "@/lib/ApiFetch"
import { translateApiError } from "@/lib/TranslateError"
import { useServerLayout } from "@/components/ServerLayoutContext"
import {
  useAssignRandomAllocation,
  useServerAllocations,
  useSetPrimaryAllocation,
  useUnassignAllocation,
} from "@/hooks/useServerAllocations"
import type { ServerAllocationRow } from "@/hooks/useServerAllocations.types"

export const NetworkTab = () => {
  const { t } = useTranslation()
  const { server } = useServerLayout()
  const query = useServerAllocations(server.id)
  const assignRandom = useAssignRandomAllocation(server.id)
  const setPrimary = useSetPrimaryAllocation(server.id)
  const unassign = useUnassignAllocation(server.id)

  const allocations = query.data?.allocations ?? []
  const primaryAllocationId = query.data?.primaryAllocationId ?? null
  const allocationLimit = query.data?.allocationLimit ?? 3
  const atLimit = allocations.length >= allocationLimit

  const errorMessage = (() => {
    const err = assignRandom.error ?? setPrimary.error ?? unassign.error
    if (err instanceof ApiFetchError) return translateApiError(t, err.body.error)
    if (err !== null && err !== undefined) return t("internal.unexpected", { ns: "errors" })
    return null
  })()

  const columns = useMemo<ColumnDef<ServerAllocationRow>[]>(
    () => [
      {
        id: "address",
        header: t("network.col.address"),
        cell: ({ row }) => (
          <code className="font-mono text-xs">
            {row.original.ip}:{row.original.port}
          </code>
        ),
      },
      {
        id: "alias",
        header: t("network.col.alias"),
        cell: ({ row }) =>
          row.original.alias !== null && row.original.alias.length > 0 ? (
            <span className="text-muted-foreground text-xs">{row.original.alias}</span>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          ),
      },
      {
        id: "primary",
        header: t("network.col.primary"),
        cell: ({ row }) =>
          row.original.id === primaryAllocationId ? (
            <span className="bg-muted rounded px-1.5 py-0.5 text-[0.65rem] font-medium uppercase">
              {t("network.primary_badge")}
            </span>
          ) : null,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const isPrimary = row.original.id === primaryAllocationId
          return (
            <div className="flex justify-end gap-2">
              {!isPrimary ? (
                <Button
                  size="xs"
                  variant="outline"
                  disabled={setPrimary.isPending}
                  onClick={() => setPrimary.mutate(row.original.id)}
                >
                  {t("network.set_primary")}
                </Button>
              ) : null}
              <Button
                size="xs"
                variant="destructive"
                disabled={isPrimary || unassign.isPending}
                title={isPrimary ? t("network.unassign_primary_error") : undefined}
                onClick={() => unassign.mutate(row.original.id)}
              >
                {t("network.unassign")}
              </Button>
            </div>
          )
        },
      },
    ],
    [t, primaryAllocationId, setPrimary, unassign]
  )

  const table = useReactTable({
    data: allocations,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="flex flex-col gap-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{t("network.title")}</CardTitle>
        </CardHeader>
        <CardInner className="p-3">
          <p className="text-sm text-muted-foreground">{t("network.description")}</p>
        </CardInner>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>{t("network.allocations_heading")}</CardTitle>
              <CardDescription>
                {t("network.limit_info", {
                  count: allocations.length,
                  max: allocationLimit,
                })}
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={atLimit || assignRandom.isPending}
              title={atLimit ? t("network.limit_reached") : undefined}
              onClick={() => assignRandom.mutate()}
            >
              {t("network.assign_random")}
            </Button>
          </div>
        </CardHeader>
        <CardInner className="p-3">
          {errorMessage !== null ? (
            <p className="text-destructive mb-2 text-xs" role="alert">
              {errorMessage}
            </p>
          ) : null}
          {query.isLoading ? (
            <p className="text-muted-foreground text-xs">{t("network.loading")}</p>
          ) : allocations.length === 0 ? (
            <p className="text-muted-foreground text-xs">{t("network.empty")}</p>
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
    </div>
  )
}

import { useCallback, useMemo, useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
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

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import {
  useAdminDeleteServer,
  useAdminServers,
  useAdminToggleSuspend,
} from "@/hooks/useAdminServers"
import type { AdminServerRow } from "@/hooks/useAdminServers.types"
import { useAllocations } from "@/hooks/useAllocations"
import { useCreateTransfer } from "@/hooks/useTransfers"
import { useNodes } from "@/hooks/useNodes"

type TransferDialogProps = {
  server: AdminServerRow
}

const TransferDialog = ({ server }: TransferDialogProps) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [targetNodeId, setTargetNodeId] = useState("")
  const [targetAllocationId, setTargetAllocationId] = useState("")

  const { data: nodesData } = useNodes()
  const { data: allocationsData } = useAllocations(targetNodeId || null)
  const createTransfer = useCreateTransfer(server.id)

  const freeNodes = (nodesData?.nodes ?? []).filter((n) => n.id !== server.nodeId)
  const freeAllocations = (allocationsData?.allocations ?? []).filter(
    (a) => a.serverId === null
  )

  const handleSubmit = () => {
    if (!targetNodeId || !targetAllocationId) return
    createTransfer.mutate(
      { targetNodeId, targetAllocationId },
      {
        onSuccess: () => {
          setOpen(false)
          setTargetNodeId("")
          setTargetAllocationId("")
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          {t("transfers.transfer_button")}
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("transfers.dialog.title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>{t("transfers.dialog.target_node_label")}</Label>
            <Select
              value={targetNodeId}
              onValueChange={(v) => {
                setTargetNodeId(v)
                setTargetAllocationId("")
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("transfers.dialog.target_node_placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {freeNodes.map((node) => (
                  <SelectItem key={node.id} value={node.id}>
                    {node.name} — {node.fqdn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("transfers.dialog.target_allocation_label")}</Label>
            <Select
              value={targetAllocationId}
              onValueChange={setTargetAllocationId}
              disabled={!targetNodeId}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("transfers.dialog.target_allocation_placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {freeAllocations.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.ip}:{a.port}
                    {a.alias ? ` (${a.alias})` : ""}
                  </SelectItem>
                ))}
                {targetNodeId && freeAllocations.length === 0 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    {t("transfers.dialog.no_free_allocations")}
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {t("transfers.dialog.cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!targetNodeId || !targetAllocationId || createTransfer.isPending}
          >
            {createTransfer.isPending
              ? t("transfers.dialog.initiating")
              : t("transfers.dialog.start")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const ActionsCell = ({ server }: { server: AdminServerRow }) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const toggleSuspend = useAdminToggleSuspend()
  const deleteServer = useAdminDeleteServer()
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div className="flex items-center gap-1.5">
      <Button variant="outline" size="sm" asChild>
        <Link
          to="/admin/servers/$serverId"
          params={{ serverId: server.id }}
          search={{ tab: "overview" }}
        >
          {t("admin_servers.view")}
        </Link>
      </Button>

      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="px-2">
            ···
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() =>
              void navigate({
                to: "/admin/servers/$serverId",
                params: { serverId: server.id },
                search: { tab: "overview" },
              })
            }
          >
            {t("admin_servers.edit")}
          </DropdownMenuItem>
          <TransferDialog server={server} />
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => toggleSuspend.mutate(server.id)}
            disabled={toggleSuspend.isPending}
          >
            {server.suspended ? t("admin_servers.unsuspend") : t("admin_servers.suspend")}
          </DropdownMenuItem>
          <DropdownMenuItem
            className={confirmDelete ? "text-destructive focus:text-destructive" : ""}
            onClick={() => {
              if (!confirmDelete) {
                setConfirmDelete(true)
                return
              }
              deleteServer.mutate(server.id, {
                onSuccess: () => {
                  setConfirmDelete(false)
                  setMenuOpen(false)
                },
              })
            }}
            onBlur={() => setConfirmDelete(false)}
            disabled={deleteServer.isPending}
          >
            {confirmDelete ? t("actions.confirm") : t("admin_servers.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
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
      {active ? (
        <HugeiconsIcon
          icon={desc ? ArrowDown01Icon : ArrowUp01Icon}
          size={12}
          className="shrink-0"
        />
      ) : null}
    </button>
  )
}

export const AdminServersPage = () => {
  const { t } = useTranslation()
  const { data, isLoading } = useAdminServers()
  const toggleSuspend = useAdminToggleSuspend()
  const deleteServer = useAdminDeleteServer()

  const [globalFilter, setGlobalFilter] = useState("")
  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }])
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({})
  const [massDeleteOpen, setMassDeleteOpen] = useState(false)

  const servers = data?.servers ?? []

  const columns = useMemo<ColumnDef<AdminServerRow>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
        enableGlobalFilter: false,
      },
      {
        id: "name",
        accessorKey: "name",
        header: t("admin_servers.col.server"),
        cell: ({ row }) => {
          const s = row.original
          return (
            <div>
              <div className="flex items-center gap-2 font-medium">
                {s.name}
                {s.suspended ? (
                  <Badge variant="destructive" className="text-xs">
                    {t("admin_servers.badge.suspended")}
                  </Badge>
                ) : null}
              </div>
              <div className="font-mono text-xs text-muted-foreground">{s.id.slice(0, 8)}</div>
            </div>
          )
        },
        filterFn: "includesString",
      },
      {
        id: "owner",
        accessorFn: (s) => `${s.ownerName ?? ""} ${s.ownerEmail ?? ""}`,
        header: t("admin_servers.col.owner"),
        cell: ({ row }) => {
          const s = row.original
          return (
            <div className="text-xs text-muted-foreground">
              <div>{s.ownerName ?? "—"}</div>
              <div>{s.ownerEmail ?? "—"}</div>
            </div>
          )
        },
        filterFn: "includesString",
      },
      {
        id: "node",
        accessorFn: (s) => `${s.nodeName ?? ""} ${s.nodeFqdn ?? ""}`,
        header: t("admin_servers.col.node"),
        cell: ({ row }) => {
          const s = row.original
          return (
            <div className="text-xs text-muted-foreground">
              <div>{s.nodeName ?? "—"}</div>
              <div className="font-mono">{s.nodeFqdn ?? "—"}</div>
            </div>
          )
        },
        filterFn: "includesString",
      },
      {
        id: "status",
        accessorKey: "status",
        header: t("admin_servers.col.status"),
        cell: ({ row }) => (
          <span className="text-xs">{t(`lifecycle.${row.original.status}`)}</span>
        ),
      },
      {
        id: "resources",
        accessorKey: "memoryLimitMb",
        header: t("admin_servers.col.resources"),
        cell: ({ row }) => {
          const s = row.original
          return (
            <div className="text-xs text-muted-foreground">
              <div>{s.memoryLimitMb} MB RAM</div>
              <div>{s.cpuLimitPercent}% CPU</div>
              <div>{s.diskLimitMb} MB disk</div>
            </div>
          )
        },
      },
      {
        id: "createdAt",
        accessorKey: "createdAt",
        header: t("admin_servers.col.created"),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {new Date(row.original.createdAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        ),
      },
      {
        id: "actions",
        header: t("admin_servers.col.actions"),
        cell: ({ row }) => <ActionsCell server={row.original} />,
        enableSorting: false,
        enableGlobalFilter: false,
      },
    ],
    [t]
  )

  const table = useReactTable({
    data: servers,
    columns,
    state: { globalFilter, sorting, rowSelection },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    globalFilterFn: "includesString",
    getRowId: (row) => row.id,
  })

  const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id])
  const selectedCount = selectedIds.length

  const handleSortToggle = (colId: string) => {
    setSorting((prev) => {
      if (prev[0]?.id === colId) {
        return [{ id: colId, desc: !prev[0].desc }]
      }
      return [{ id: colId, desc: false }]
    })
  }

  const handleMassSuspend = () => {
    for (const id of selectedIds) {
      toggleSuspend.mutate(id)
    }
    setRowSelection({})
  }

  const handleMassDelete = useCallback(() => {
    for (const id of selectedIds) {
      deleteServer.mutate(id)
    }
    setRowSelection({})
    setMassDeleteOpen(false)
  }, [selectedIds, deleteServer])

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-base font-semibold">{t("admin_servers.title")}</h1>
          <p className="text-muted-foreground text-xs">{t("admin_servers.description")}</p>
        </div>
        <Button size="sm" asChild>
          <Link to="/admin/create-server">{t("admin_servers.create")}</Link>
        </Button>
      </header>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <HugeiconsIcon
            icon={Search01Icon}
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder={t("admin_servers.search_placeholder")}
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-8 text-sm h-8"
          />
        </div>

        {selectedCount > 0 && (
          <div className="flex items-center gap-2 ml-2">
            <span className="text-xs text-muted-foreground">
              {t("admin_servers.selected", { count: selectedCount })}
            </span>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleMassSuspend}
              disabled={toggleSuspend.isPending}
            >
              {t("admin_servers.mass_suspend")}
            </Button>
            <Dialog open={massDeleteOpen} onOpenChange={setMassDeleteOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="destructive">
                  {t("admin_servers.mass_delete")}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>{t("admin_servers.mass_delete_title")}</DialogTitle>
                  <DialogDescription>
                    {t("admin_servers.mass_delete_confirm", { count: selectedCount })}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setMassDeleteOpen(false)}>
                    {t("actions.cancel")}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleMassDelete}
                    disabled={deleteServer.isPending}
                  >
                    {t("admin_servers.mass_delete")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead key={header.id} className="whitespace-nowrap">
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
                  {t("admin_servers.loading")}
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-6 text-center text-muted-foreground text-sm">
                  {t("admin_servers.empty")}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
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
    </div>
  )
}

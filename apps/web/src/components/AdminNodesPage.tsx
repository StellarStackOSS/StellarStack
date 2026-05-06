import { useState, useMemo } from "react"
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
import { Search01Icon } from "@hugeicons/core-free-icons"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardHeader,
  CardInner,
  CardTitle,
} from "@workspace/ui/components/card"
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
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
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

import { ApiFetchError } from "@/lib/ApiFetch"
import { translateApiError } from "@/lib/TranslateError"
import {
  useNodes,
  useCreateNode,
  useUpdateNode,
  useDeleteNode,
  useMintPairingToken,
} from "@/hooks/useNodes"
import {
  useAllocations,
  useCreateAllocations,
  useDeleteAllocations,
} from "@/hooks/useAllocations"
import type { NodeListRow, CreateNodeRequest, UpdateNodeRequest } from "@/hooks/useNodes.types"
import type { AllocationRow, CreateAllocationsRequest } from "@/hooks/useAllocations.types"

const formatMb = (mb: number): string =>
  mb >= 1024 ? `${(mb / 1024).toFixed(0)} GB` : `${mb} MB`

const NodeStatusBadge = ({ connected }: { connected: boolean }) => {
  const { t } = useTranslation()
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-1.5 rounded-full ${connected ? "bg-chart-1" : "bg-muted-foreground"}`} />
      <span className={connected ? "text-chart-1" : "text-muted-foreground"}>
        {connected ? t("nodes.status.online") : t("nodes.status.offline")}
      </span>
    </span>
  )
}

const NodeFormFields = ({
  value,
  onChange,
}: {
  value: CreateNodeRequest
  onChange: (next: CreateNodeRequest) => void
}) => {
  const { t } = useTranslation()
  const set = <K extends keyof CreateNodeRequest>(key: K, val: CreateNodeRequest[K]) =>
    onChange({ ...value, [key]: val })

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <Label>{t("nodes.create_field.name")}</Label>
        <Input value={value.name} onChange={(e) => set("name", e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label>{t("nodes.create_field.fqdn")}</Label>
        <Input value={value.fqdn} onChange={(e) => set("fqdn", e.target.value)} required placeholder="node1.example.com" />
      </div>
      <div className="space-y-1.5">
        <Label>{t("nodes.create_field.scheme")}</Label>
        <Select
          value={value.scheme}
          onValueChange={(v) => set("scheme", v === "https" ? "https" : "http")}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="http">http</SelectItem>
            <SelectItem value="https">https</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>{t("nodes.create_field.daemon_port")}</Label>
        <Input type="number" value={value.daemonPort} onChange={(e) => set("daemonPort", Number(e.target.value))} />
      </div>
      <div className="space-y-1.5">
        <Label>{t("nodes.create_field.sftp_port")}</Label>
        <Input type="number" value={value.sftpPort} onChange={(e) => set("sftpPort", Number(e.target.value))} />
      </div>
      <div className="space-y-1.5">
        <Label>{t("nodes.create_field.memory_mb")}</Label>
        <Input type="number" value={value.memoryTotalMb} onChange={(e) => set("memoryTotalMb", Number(e.target.value))} />
      </div>
      <div className="col-span-2 space-y-1.5">
        <Label>{t("nodes.create_field.disk_mb")}</Label>
        <Input type="number" value={value.diskTotalMb} onChange={(e) => set("diskTotalMb", Number(e.target.value))} />
      </div>
    </div>
  )
}

const initialForm: CreateNodeRequest = {
  name: "",
  fqdn: "",
  scheme: "http",
  daemonPort: 8080,
  sftpPort: 2022,
  memoryTotalMb: 4096,
  diskTotalMb: 50_000,
}

const CreateNodeSheet = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const { t } = useTranslation()
  const create = useCreateNode()
  const [form, setForm] = useState<CreateNodeRequest>(initialForm)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    try {
      await create.mutateAsync(form)
      setForm(initialForm)
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
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent side="right" className="w-full max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("nodes.create_title")}</SheetTitle>
          <SheetDescription>{t("nodes.create_description")}</SheetDescription>
        </SheetHeader>
        <SheetBody>
          <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
            <NodeFormFields value={form} onChange={setForm} />
            {error !== null && <p className="text-destructive text-xs" role="alert">{error}</p>}
            <div className="flex justify-end">
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? t("nodes.create_pending") : t("nodes.create_button")}
              </Button>
            </div>
          </form>
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}

const initialAllocationForm = { ip: "0.0.0.0", startPort: 25565, endPort: 25569, alias: "" }

const AllocationsPanel = ({ nodeId }: { nodeId: string }) => {
  const { t } = useTranslation()
  const allocations = useAllocations(nodeId)
  const create = useCreateAllocations(nodeId)
  const remove = useDeleteAllocations(nodeId)

  const [form, setForm] = useState(initialAllocationForm)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [busyDelete, setBusyDelete] = useState<string | null>(null)

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMessage(null)
    if (form.endPort < form.startPort) {
      setErrorMessage(t("nodes.allocations.end_port_error"))
      return
    }
    const body: CreateAllocationsRequest = {
      ip: form.ip.trim(),
      portRange: { start: form.startPort, end: form.endPort },
      ...(form.alias.trim().length > 0 ? { alias: form.alias.trim() } : {}),
    }
    try {
      await create.mutateAsync(body)
      setForm({ ...form, alias: "" })
    } catch (err) {
      setErrorMessage(
        err instanceof ApiFetchError
          ? translateApiError(t, err.body.error)
          : t("internal.unexpected", { ns: "errors" })
      )
    }
  }

  const handleDelete = async (row: AllocationRow) => {
    if (row.serverId !== null) return
    if (!window.confirm(t("nodes.allocations.confirm_delete", { ip: row.ip, port: row.port }))) return
    setBusyDelete(row.id)
    try {
      await remove.mutateAsync([row.id])
    } catch (err) {
      setErrorMessage(
        err instanceof ApiFetchError
          ? translateApiError(t, err.body.error)
          : t("internal.unexpected", { ns: "errors" })
      )
    } finally {
      setBusyDelete(null)
    }
  }

  const rows = allocations.data?.allocations ?? []
  const free = rows.filter((r) => r.serverId === null).length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs">{t("nodes.allocations.heading", { total: rows.length, free })}</CardTitle>
      </CardHeader>
      <CardInner className="p-3 flex flex-col gap-3">
        {allocations.isLoading ? (
          <p className="text-muted-foreground text-xs">{t("nodes.allocations.loading")}</p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground text-xs">{t("nodes.allocations.empty")}</p>
        ) : (
          <ul className="flex flex-wrap gap-1">
            {rows.map((row) => {
              const inUse = row.serverId !== null
              return (
                <li
                  key={row.id}
                  className={`border-border flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[0.65rem] ${inUse ? "opacity-70" : ""}`}
                  title={inUse ? t("nodes.allocations.bound_to", { serverId: row.serverId }) : t("nodes.allocations.free")}
                >
                  <span className={`size-1 rounded-full ${inUse ? "bg-chart-2" : "bg-chart-1"}`} />
                  <span>{row.ip}:{row.port}</span>
                  {!inUse && (
                    <button
                      type="button"
                      onClick={() => void handleDelete(row)}
                      disabled={busyDelete === row.id}
                      className="text-destructive ml-1"
                      title={t("actions.delete")}
                    >
                      ✕
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        <form className="grid grid-cols-2 gap-2 sm:grid-cols-5" onSubmit={(e) => void handleAdd(e)}>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">{t("nodes.allocations.field.ip")}</Label>
            <Input value={form.ip} onChange={(e) => setForm({ ...form, ip: e.target.value })} required className="h-7 text-xs" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">{t("nodes.allocations.field.start_port")}</Label>
            <Input type="number" min={1} max={65535} value={form.startPort} onChange={(e) => setForm({ ...form, startPort: Number(e.target.value) })} required className="h-7 text-xs" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">{t("nodes.allocations.field.end_port")}</Label>
            <Input type="number" min={1} max={65535} value={form.endPort} onChange={(e) => setForm({ ...form, endPort: Number(e.target.value) })} required className="h-7 text-xs" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">{t("nodes.allocations.field.alias")}</Label>
            <Input value={form.alias} onChange={(e) => setForm({ ...form, alias: e.target.value })} className="h-7 text-xs" />
          </div>
          <div className="flex items-end">
            <Button type="submit" size="sm" disabled={create.isPending} className="w-full">
              {create.isPending ? t("nodes.allocations.add_pending") : t("nodes.allocations.add_button")}
            </Button>
          </div>
        </form>
        {errorMessage !== null && (
          <p className="text-destructive text-xs" role="alert">{errorMessage}</p>
        )}
        </CardInner>
    </Card>
  )
}

const EditNodeSheet = ({ node, onClose }: { node: NodeListRow; onClose: () => void }) => {
  const { t } = useTranslation()
  const update = useUpdateNode(node.id)
  const mint = useMintPairingToken()

  const [form, setForm] = useState<UpdateNodeRequest>({
    name: node.name,
    fqdn: node.fqdn,
    scheme: node.scheme,
    daemonPort: node.daemonPort,
    sftpPort: node.sftpPort,
    memoryTotalMb: node.memoryTotalMb,
    diskTotalMb: node.diskTotalMb,
  })
  const [error, setError] = useState<string | null>(null)
  const [revealedToken, setRevealedToken] = useState<{ token: string; expiresAt: string } | null>(null)

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    try {
      await update.mutateAsync(form)
    } catch (err) {
      setError(
        err instanceof ApiFetchError
          ? translateApiError(t, err.body.error)
          : t("internal.unexpected", { ns: "errors" })
      )
    }
  }

  const handleMint = async () => {
    try {
      const result = await mint.mutateAsync(node.id)
      setRevealedToken({ token: result.token, expiresAt: result.expiresAt })
    } catch (err) {
      setError(
        err instanceof ApiFetchError
          ? translateApiError(t, err.body.error)
          : t("internal.unexpected", { ns: "errors" })
      )
    }
  }

  const command = revealedToken !== null ? `stellar-daemon configure ${revealedToken.token}` : ""

  return (
    <Sheet open onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent side="right" className="w-full max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("nodes.edit_title")}</SheetTitle>
          <SheetDescription>{node.name}</SheetDescription>
        </SheetHeader>
        <SheetBody>
          <Card>
            <CardHeader>
              <CardTitle>{t("nodes.create_heading")}</CardTitle>
            </CardHeader>
            <CardInner className="p-3">
              <form onSubmit={(e) => void handleSave(e)} className="flex flex-col gap-4">
                <NodeFormFields value={form as CreateNodeRequest} onChange={setForm} />
                {error !== null && <p className="text-destructive text-xs" role="alert">{error}</p>}
                <div className="flex justify-end">
                  <Button type="submit" size="sm" disabled={update.isPending}>
                    {update.isPending ? t("settings.saving") : t("nodes.save_settings")}
                  </Button>
                </div>
              </form>
            </CardInner>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("nodes.generate_token")}</CardTitle>
            </CardHeader>
            <CardInner className="p-3 flex flex-col gap-3">
              {revealedToken !== null ? (
                <>
                  <p className="text-muted-foreground text-xs">
                    {t("nodes.token_dialog.body", { expiresAt: revealedToken.expiresAt })}
                  </p>
                  <pre className="bg-muted overflow-x-auto rounded p-2 font-mono text-xs">{command}</pre>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => void navigator.clipboard.writeText(command)}>
                      {t("nodes.token_dialog.copy")}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setRevealedToken(null)}>
                      {t("nodes.token_dialog.done")}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" disabled={mint.isPending} onClick={() => void handleMint()}>
                    {mint.isPending ? t("nodes.generating_token") : t("nodes.generate_token")}
                  </Button>
                </div>
              )}
              </CardInner>
          </Card>

          <AllocationsPanel nodeId={node.id} />
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}

const DeleteNodeDialog = ({
  node,
  onClose,
}: {
  node: NodeListRow
  onClose: () => void
}) => {
  const { t } = useTranslation()
  const deleteNode = useDeleteNode()
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setError(null)
    try {
      await deleteNode.mutateAsync(node.id)
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
          <DialogTitle>{t("nodes.delete_title")}</DialogTitle>
          <DialogDescription>
            {t("nodes.delete_confirm", { name: node.name })}
          </DialogDescription>
        </DialogHeader>
        {error !== null && <p className="text-destructive text-xs" role="alert">{error}</p>}
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>{t("actions.cancel")}</Button>
          <Button variant="destructive" size="sm" disabled={deleteNode.isPending} onClick={() => void handleDelete()}>
            {deleteNode.isPending ? "Deleting…" : t("actions.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export const AdminNodesPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data, isLoading } = useNodes()

  const [globalFilter, setGlobalFilter] = useState("")
  const [sorting, setSorting] = useState<SortingState>([{ id: "name", desc: false }])
  const [deleteNode, setDeleteNode] = useState<NodeListRow | null>(null)

  const nodes = data?.nodes ?? []

  const columns = useMemo<ColumnDef<NodeListRow>[]>(
    () => [
      {
        id: "name",
        accessorKey: "name",
        header: t("nodes.col.name"),
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.name}</p>
            <p className="text-muted-foreground font-mono text-xs">{row.original.id.slice(0, 8)}</p>
          </div>
        ),
        filterFn: "includesString",
      },
      {
        id: "address",
        accessorFn: (n) => `${n.fqdn}:${n.daemonPort}`,
        header: t("nodes.col.address"),
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.scheme}://{row.original.fqdn}:{row.original.daemonPort}
          </span>
        ),
      },
      {
        id: "status",
        accessorFn: (n) => (n.connectedAt !== null ? "online" : "offline"),
        header: t("nodes.col.status"),
        cell: ({ row }) => <NodeStatusBadge connected={row.original.connectedAt !== null} />,
      },
      {
        id: "resources",
        header: t("nodes.col.resources"),
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">
            {formatMb(row.original.memoryTotalMb)} RAM · {formatMb(row.original.diskTotalMb)} disk
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
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => e.stopPropagation()}>
                ···
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => void navigate({ to: "/admin/nodes/$nodeId", params: { nodeId: row.original.id } })}
              >
                {t("nodes.edit")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={(e) => { e.stopPropagation(); setDeleteNode(row.original) }}
              >
                {t("nodes.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        enableSorting: false,
        enableGlobalFilter: false,
      },
    ],
    [t, navigate]
  )

  const table = useReactTable({
    data: nodes,
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
          <h1 className="text-base font-semibold">{t("nodes.title")}</h1>
          <p className="text-muted-foreground text-xs">{t("nodes.description")}</p>
        </div>
        <Button size="sm" asChild>
          <Link to="/admin/create-node">{t("nodes.create")}</Link>
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
                  {t("nodes.loading")}
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-6 text-center text-muted-foreground text-sm">
                  {t("nodes.empty")}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => void navigate({ to: "/admin/nodes/$nodeId", params: { nodeId: row.original.id } })}
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

      {deleteNode !== null && <DeleteNodeDialog node={deleteNode} onClose={() => setDeleteNode(null)} />}
    </div>
  )
}

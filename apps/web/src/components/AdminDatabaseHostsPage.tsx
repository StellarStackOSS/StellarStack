import { useState } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardInner,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import { ConfirmDialog } from "@/components/ConfirmDialog"
import {
  useCreateDatabaseHost,
  useDatabaseHosts,
  useDatabaseTypes,
  useDeleteDatabaseHost,
} from "@/hooks/useDatabaseHosts"
import { useNodes } from "@/hooks/useNodes"
import { ApiFetchError } from "@/lib/ApiFetch"
import { notify } from "@/lib/notify"

export const AdminDatabaseHostsPage = () => {
  const hostsQuery = useDatabaseHosts()
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const deleteHost = useDeleteDatabaseHost()

  const hosts = hostsQuery.data?.hosts ?? []

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-base font-semibold">Database Hosts</h1>
        <p className="text-muted-foreground text-xs">
          Spin up dedicated database engines that game servers can attach to.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>All hosts</CardTitle>
          <CardDescription>
            Each host is a long-running container managed by its node.
          </CardDescription>
          <CardAction>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              New host
            </Button>
          </CardAction>
        </CardHeader>
        <CardInner className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs h-9">Name</TableHead>
                <TableHead className="text-xs h-9">Type</TableHead>
                <TableHead className="text-xs h-9">Node</TableHead>
                <TableHead className="text-xs h-9">Address</TableHead>
                <TableHead className="text-xs h-9">Memory</TableHead>
                <TableHead className="text-xs h-9">Status</TableHead>
                <TableHead className="text-xs h-9">Shared</TableHead>
                <TableHead className="text-xs h-9" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {hostsQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-muted-foreground text-xs">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : hosts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-muted-foreground text-xs">
                    No database hosts yet.
                  </TableCell>
                </TableRow>
              ) : (
                hosts.map((host) => (
                  <TableRow key={host.id}>
                    <TableCell className="text-xs font-medium">{host.name}</TableCell>
                    <TableCell className="text-xs">{host.dbType}</TableCell>
                    <TableCell className="text-xs">{host.nodeName ?? "—"}</TableCell>
                    <TableCell className="text-xs font-mono">
                      {host.allocationIp !== null && host.allocationPort !== null
                        ? `${host.allocationIp}:${host.allocationPort}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-xs">{host.memoryLimitMb} MB</TableCell>
                    <TableCell className="text-xs">
                      <Badge variant={host.status === "running" ? "default" : "secondary"}>
                        {host.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {host.shared ? "Yes" : "No"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="xs"
                        variant="destructive"
                        onClick={() => setDeleteTarget({ id: host.id, name: host.name })}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardInner>
      </Card>

      <CreateHostDialog open={createOpen} onOpenChange={setCreateOpen} />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null) }}
        title="Delete database host"
        description={`Stop and remove "${deleteTarget?.name ?? ""}". The container's data volume on the node host is left in place.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          if (deleteTarget === null) return
          try {
            await deleteHost.mutateAsync(deleteTarget.id)
            notify.success("Database host deleted")
            setDeleteTarget(null)
          } catch (err) {
            const msg = err instanceof ApiFetchError
              ? (err.body.error.code ?? "Failed")
              : "Failed"
            notify.error(msg)
          }
        }}
      />
    </div>
  )
}

const CreateHostDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) => {
  const nodesQuery = useNodes()
  const typesQuery = useDatabaseTypes()
  const create = useCreateDatabaseHost()

  const [name, setName] = useState("")
  const [nodeId, setNodeId] = useState("")
  const [dbType, setDbType] = useState("")
  const [memoryLimitMb, setMemoryLimitMb] = useState(1024)
  const [diskLimitMb, setDiskLimitMb] = useState(4096)
  const [shared, setShared] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setName(""); setNodeId(""); setDbType("")
    setMemoryLimitMb(1024); setDiskLimitMb(4096); setShared(true); setError(null)
  }

  const submit = async () => {
    setError(null)
    if (name === "" || nodeId === "" || dbType === "") {
      setError("Name, node, and type are required.")
      return
    }
    try {
      await create.mutateAsync({
        name, nodeId, dbType, memoryLimitMb, diskLimitMb, shared,
      })
      notify.success("Database host created")
      reset()
      onOpenChange(false)
    } catch (err) {
      setError(
        err instanceof ApiFetchError
          ? (err.body.error.code ?? "Failed to create host")
          : "Failed to create host"
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New database host</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="prod-postgres" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Node</Label>
            <Select value={nodeId} onValueChange={setNodeId}>
              <SelectTrigger><SelectValue placeholder="Select a node" /></SelectTrigger>
              <SelectContent>
                {(nodesQuery.data?.nodes ?? []).map((n) => (
                  <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Type</Label>
            <Select value={dbType} onValueChange={setDbType}>
              <SelectTrigger><SelectValue placeholder="Select a database engine" /></SelectTrigger>
              <SelectContent>
                {(typesQuery.data?.types ?? []).map((t) => (
                  <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Memory (MB)</Label>
              <Input
                type="number"
                value={memoryLimitMb}
                onChange={(e) => setMemoryLimitMb(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Disk (MB)</Label>
              <Input
                type="number"
                value={diskLimitMb}
                onChange={(e) => setDiskLimitMb(Number(e.target.value))}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={shared}
              onChange={(e) => setShared(e.target.checked)}
            />
            Shared (any user can attach databases to this host)
          </label>
          {error !== null && (
            <p className="text-destructive text-xs">{error}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" disabled={create.isPending} onClick={() => void submit()}>
            {create.isPending ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

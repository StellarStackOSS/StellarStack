import { useState } from "react"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

import { useNodes } from "@/hooks/useNodes"
import { useCreateTransfer, useTransfers } from "@/hooks/useTransfers"
import type { TransferRow } from "@/hooks/useTransfers.types"
import { useAllocations } from "@/hooks/useAllocations"

type TransferDialogProps = {
  serverId: string
  currentNodeId: string
}

const TransferDialog = ({ serverId, currentNodeId }: TransferDialogProps) => {
  const [open, setOpen] = useState(false)
  const [targetNodeId, setTargetNodeId] = useState("")
  const [targetAllocationId, setTargetAllocationId] = useState("")

  const { data: nodesData } = useNodes()
  const { data: allocationsData } = useAllocations(targetNodeId || null)
  const createTransfer = useCreateTransfer(serverId)

  const freeNodes = (nodesData?.nodes ?? []).filter(
    (n) => n.id !== currentNodeId
  )
  const freeAllocations = (allocationsData?.allocations ?? []).filter(
    (a) => a.serverId === null
  )

  const handleSubmit = () => {
    if (!targetNodeId || !targetAllocationId) return
    createTransfer.mutate(
      { targetNodeId, targetAllocationId },
      { onSuccess: () => setOpen(false) }
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Transfer Server
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer Server</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Target Node</Label>
            <Select
              value={targetNodeId}
              onValueChange={(v) => {
                setTargetNodeId(v)
                setTargetAllocationId("")
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a node…" />
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
            <Label>Target Allocation</Label>
            <Select
              value={targetAllocationId}
              onValueChange={setTargetAllocationId}
              disabled={!targetNodeId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select an allocation…" />
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
                    No free allocations on this node.
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              !targetNodeId ||
              !targetAllocationId ||
              createTransfer.isPending
            }
          >
            {createTransfer.isPending ? "Initiating…" : "Start Transfer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const statusBadge = (status: TransferRow["status"]) => {
  const map: Record<TransferRow["status"], string> = {
    pending: "bg-yellow-500/15 text-yellow-600",
    running: "bg-blue-500/15 text-blue-600",
    completed: "bg-green-500/15 text-green-700",
    failed: "bg-red-500/15 text-red-600",
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${map[status]}`}
    >
      {status}
    </span>
  )
}

type TransfersTabProps = {
  serverId: string
  currentNodeId: string
}

export const TransfersTab = ({ serverId, currentNodeId }: TransfersTabProps) => {
  const { data, isLoading } = useTransfers(serverId)
  const transfers = data?.transfers ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Server Transfers</h2>
          <p className="text-sm text-muted-foreground">
            Move this server to a different node.
          </p>
        </div>
        <TransferDialog serverId={serverId} currentNodeId={currentNodeId} />
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}

      {!isLoading && transfers.length === 0 && (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No transfers yet.
        </p>
      )}

      {transfers.length > 0 && (
        <div className="space-y-2">
          {transfers.map((t) => (
            <div
              key={t.id}
              className="flex items-start justify-between rounded-lg border bg-card p-4"
            >
              <div className="space-y-0.5">
                <p className="text-sm font-medium">
                  Transfer {t.id.slice(0, 8)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Started{" "}
                  {new Date(t.createdAt).toLocaleString()}
                  {t.completedAt &&
                    ` · Completed ${new Date(t.completedAt).toLocaleString()}`}
                </p>
                {t.error && (
                  <p className="text-xs text-destructive">{t.error}</p>
                )}
              </div>
              <div>{statusBadge(t.status)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

import { useState } from "react"

import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Label } from "@workspace/ui/components/label"

export type RestoreBackupDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  backupName: string
  onConfirm: (snapshotBeforeRestore: boolean) => Promise<void>
}

export const RestoreBackupDialog = ({
  open,
  onOpenChange,
  backupName,
  onConfirm,
}: RestoreBackupDialogProps) => {
  const [snapshot, setSnapshot] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    setBusy(true)
    setError(null)
    try {
      await onConfirm(snapshot)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v) }}>
      <DialogContent className="sm:max-w-sm" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="text-sm">Restore backup</DialogTitle>
          <DialogDescription className="text-xs">
            Restore{" "}
            <span className="font-mono text-foreground">{backupName}</span>?
            The server will be stopped and its files replaced.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-3 rounded-md border border-border bg-muted/30 p-3">
          <Checkbox
            id="snapshot-before-restore"
            checked={snapshot}
            onCheckedChange={(v) => setSnapshot(v === true)}
            disabled={busy}
            className="mt-0.5"
          />
          <div className="flex flex-col gap-0.5">
            <Label htmlFor="snapshot-before-restore" className="text-xs font-medium cursor-pointer">
              Snapshot current files first
            </Label>
            <p className="text-[0.7rem] text-muted-foreground leading-relaxed">
              Creates a backup of the server's current state before overwriting.
              You can use it to undo this restore if needed.
            </p>
          </div>
        </div>

        {error !== null ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : null}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm" disabled={busy}>
              Cancel
            </Button>
          </DialogClose>
          <Button size="sm" onClick={() => void handleConfirm()} disabled={busy}>
            {busy ? "Restoring…" : "Restore"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

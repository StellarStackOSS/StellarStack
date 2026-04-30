import { useEffect, useRef, useState } from "react"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

type NewFileDialogProps = {
  open: boolean
  currentDir: string
  onOpenChange: (open: boolean) => void
  onCreate: (path: string) => Promise<void>
}

/**
 * Dialog for creating a new empty file. Resolves the full path from
 * `currentDir + "/" + filename` before calling `onCreate`.
 */
export const NewFileDialog = ({
  open,
  currentDir,
  onOpenChange,
  onCreate,
}: NewFileDialogProps) => {
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setName("")
      setError(null)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const handleCreate = async () => {
    const trimmed = name.trim()
    if (trimmed.length === 0) {
      setError("File name is required.")
      return
    }
    if (trimmed.includes("/")) {
      setError("File name cannot contain slashes.")
      return
    }
    const dir = currentDir.replace(/\/+$/, "")
    const fullPath = dir ? `${dir}/${trimmed}` : `/${trimmed}`
    setBusy(true)
    setError(null)
    try {
      await onCreate(fullPath)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") void handleCreate()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v) }}>
      <DialogContent className="sm:max-w-sm" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="text-sm">New file</DialogTitle>
          <DialogDescription className="text-xs">
            Creating in{" "}
            <code className="bg-muted rounded px-1">{currentDir}</code>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label className="text-xs" htmlFor="new-file-name">
            File name
          </Label>
          <Input
            ref={inputRef}
            id="new-file-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="server.properties"
            className="text-xs h-8 font-mono"
          />
          {error !== null ? (
            <p className="text-xs text-destructive">{error}</p>
          ) : null}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm" disabled={busy}>
              Cancel
            </Button>
          </DialogClose>
          <Button size="sm" disabled={busy} onClick={() => void handleCreate()}>
            {busy ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

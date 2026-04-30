import { useEffect, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowUp01Icon,
  FolderIcon,
  FolderOpenIcon,
} from "@hugeicons/core-free-icons"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"

import { useFileList } from "@/hooks/useFiles"
import type { FileEntry } from "@/hooks/useFiles.types"

type FileMoveDialogProps = {
  serverId: string
  entry: FileEntry | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onMove: (entry: FileEntry, destDir: string) => Promise<void>
}

const parentOf = (p: string): string => {
  if (p === "/" || p === "") return "/"
  const t = p.replace(/\/+$/, "")
  const i = t.lastIndexOf("/")
  return i <= 0 ? "/" : t.slice(0, i)
}

export const FileMoveDialog = ({
  serverId,
  entry,
  open,
  onOpenChange,
  onMove,
}: FileMoveDialogProps) => {
  const [browsePath, setBrowsePath] = useState("/")
  const [destInput, setDestInput] = useState("/")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const list = useFileList(serverId, browsePath)
  const folders = (list.data?.entries ?? []).filter((e) => e.isDir)

  useEffect(() => {
    if (open && entry !== null) {
      const initial = parentOf(entry.path)
      setBrowsePath(initial)
      setDestInput(initial)
      setError(null)
    }
  }, [open, entry])

  const handleBrowseTo = (p: string) => {
    setBrowsePath(p)
    setDestInput(p)
  }

  const handleConfirm = async () => {
    if (entry === null) return
    const dir = destInput.trim() || "/"
    setBusy(true)
    setError(null)
    try {
      await onMove(entry, dir)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  if (entry === null) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">
            Move{" "}
            <span className="font-mono text-muted-foreground">{entry.name}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {/* Destination path input */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">
              Destination directory
            </label>
            <Input
              value={destInput}
              onChange={(e) => setDestInput(e.target.value)}
              className="font-mono text-xs h-8"
              placeholder="/"
            />
          </div>

          {/* Folder browser */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Browse:{" "}
                <code className="bg-muted rounded px-1">{browsePath}</code>
              </span>
              {browsePath !== "/" ? (
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => handleBrowseTo(parentOf(browsePath))}
                >
                  <HugeiconsIcon icon={ArrowUp01Icon} className="size-3" />
                  Up
                </button>
              ) : null}
            </div>

            <div className="border border-border rounded-md max-h-48 overflow-y-auto">
              {list.isLoading ? (
                <p className="text-xs text-muted-foreground p-2">Loading…</p>
              ) : folders.length === 0 ? (
                <p className="text-xs text-muted-foreground p-2 italic">
                  No subfolders here
                </p>
              ) : (
                <ul>
                  {folders.map((folder) => {
                    const isSelf =
                      entry.isDir &&
                      (folder.path === entry.path ||
                        folder.path.startsWith(entry.path + "/"))
                    return (
                      <li key={folder.path}>
                        <button
                          type="button"
                          disabled={isSelf}
                          onClick={() => handleBrowseTo(folder.path)}
                          className={[
                            "w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left",
                            "hover:bg-muted",
                            destInput === folder.path
                              ? "bg-muted font-medium"
                              : "",
                            isSelf
                              ? "opacity-40 cursor-not-allowed"
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          <HugeiconsIcon
                            icon={
                              destInput === folder.path
                                ? FolderOpenIcon
                                : FolderIcon
                            }
                            className="size-3.5 text-chart-2 shrink-0"
                          />
                          {folder.name}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>

          {error !== null ? (
            <p className="text-xs text-destructive">{error}</p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={() => void handleConfirm()} disabled={busy}>
            {busy ? "Moving…" : "Move here"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

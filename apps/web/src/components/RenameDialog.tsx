import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

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

type RenameDialogProps = {
  open: boolean
  currentName: string
  onOpenChange: (open: boolean) => void
  onRename: (newName: string) => Promise<void>
}

export const RenameDialog = ({
  open,
  currentName,
  onOpenChange,
  onRename,
}: RenameDialogProps) => {
  const { t } = useTranslation()
  const [name, setName] = useState(currentName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setName(currentName)
      setError(null)
      setTimeout(() => {
        inputRef.current?.focus()
        const dotIndex = currentName.lastIndexOf(".")
        if (dotIndex > 0) {
          inputRef.current?.setSelectionRange(0, dotIndex)
        } else {
          inputRef.current?.select()
        }
      }, 50)
    }
  }, [open, currentName])

  const handleConfirm = async () => {
    const trimmed = name.trim()
    if (trimmed.length === 0) {
      setError(t("files.rename.error_required", { defaultValue: "Name is required." }))
      return
    }
    if (trimmed.includes("/")) {
      setError(t("files.rename.error_slash", { defaultValue: "Name cannot contain slashes." }))
      return
    }
    if (trimmed === currentName) {
      onOpenChange(false)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onRename(trimmed)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") void handleConfirm()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v) }}>
      <DialogContent className="sm:max-w-sm" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="text-sm">
            {t("files.rename.title", { defaultValue: "Rename" })}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {t("files.rename.description", {
              defaultValue: "Rename {{name}}",
              name: currentName,
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label className="text-xs" htmlFor="rename-name">
            {t("files.rename.field", { defaultValue: "New name" })}
          </Label>
          <Input
            ref={inputRef}
            id="rename-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="text-xs h-8 font-mono"
          />
          {error !== null ? (
            <p className="text-xs text-destructive">{error}</p>
          ) : null}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm" disabled={busy}>
              {t("actions.cancel", { defaultValue: "Cancel" })}
            </Button>
          </DialogClose>
          <Button size="sm" disabled={busy} onClick={() => void handleConfirm()}>
            {busy
              ? t("files.rename.saving", { defaultValue: "Renaming…" })
              : t("files.rename.confirm", { defaultValue: "Rename" })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

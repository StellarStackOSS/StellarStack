import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"

import { useServerLayout } from "@/components/ServerLayoutContext"
import { useWriteFile } from "@/hooks/useFiles"

/**
 * Pelican-style modal that surfaces when the daemon detects the
 * Minecraft EULA prompt in the container's stdout. The container
 * exits cleanly on its own — we don't kill it, and we don't suppress
 * the offline transition. We just give the user a one-click path to
 * accept the EULA and restart, instead of leaving them to figure out
 * what's wrong from the console output.
 *
 * Trigger: `console.daemonError === "eula-required"` (set by the
 * `daemon error` WS event from `useConsole`). Dismissal clears the
 * flag locally; a successful start clears it automatically.
 */
export const EulaModal = () => {
  const { t } = useTranslation()
  const { server, console } = useServerLayout()
  const writeFile = useWriteFile(server.id)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const open = console.daemonError === "eula-required"

  const accept = async () => {
    setError(null)
    setBusy(true)
    try {
      await writeFile.mutateAsync({
        path: "/eula.txt",
        content: "eula=true\n",
      })
      console.clearDaemonError()
      console.setState("start")
    } catch {
      setError(t("eula.error.write_failed"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) console.clearDaemonError()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("eula.title")}</DialogTitle>
          <DialogDescription>{t("eula.description")}</DialogDescription>
        </DialogHeader>
        <div className="text-muted-foreground flex flex-col gap-2 text-xs">
          <p>{t("eula.body_line_1")}</p>
          <p>
            {t("eula.body_line_2")}{" "}
            <a
              href="https://aka.ms/MinecraftEULA"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              aka.ms/MinecraftEULA
            </a>
            .
          </p>
        </div>
        {error !== null ? (
          <p className="text-destructive text-xs" role="alert">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => console.clearDaemonError()}
            disabled={busy}
          >
            {t("eula.cancel")}
          </Button>
          <Button size="sm" onClick={accept} disabled={busy}>
            {busy ? t("eula.accepting") : t("eula.accept_and_start")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

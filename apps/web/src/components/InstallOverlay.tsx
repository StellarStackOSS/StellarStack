import { useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { useTranslation } from "react-i18next"

import { Button } from "@workspace/ui/components/button"

import { DotmSquare3 } from "@/components/DotmSquare3"
import { useServerInstall } from "@/hooks/useServerInstall"
import { useReinstallServer } from "@/hooks/useServerSettings"

/**
 * Standard install panel. While the server's `installState` is
 * `pending` or `running` we cover the page body with a streaming-log
 * panel; on `failed` we surface a Retry button; on `succeeded` we
 * unmount and let the normal Overview render.
 */
export const InstallOverlay = ({
  serverId,
  installState,
}: {
  serverId: string
  installState: "pending" | "running" | "succeeded" | "failed"
}) => {
  const { t } = useTranslation()
  const enabled =
    installState === "pending" ||
    installState === "running" ||
    installState === "failed"
  const installQuery = useServerInstall(serverId, enabled)
  const reinstall = useReinstallServer(serverId)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el === null) return
    el.scrollTop = el.scrollHeight
  }, [installQuery.data?.log.length])

  if (!enabled) return null

  const log = installQuery.data?.log ?? []
  const isFailed = installState === "failed"
  const isPending = installState === "pending"

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-30 flex flex-col gap-3 bg-background/95 p-4 backdrop-blur-sm"
    >
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {isFailed ? (
            <span className="bg-destructive/15 text-destructive inline-flex size-9 items-center justify-center rounded-md text-sm font-bold">
              !
            </span>
          ) : (
            <DotmSquare3 size={28} dotSize={3} speed={1.5} animated />
          )}
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">
              {isFailed
                ? t("install.failed_title", { defaultValue: "Installation failed" })
                : isPending
                  ? t("install.pending_title", { defaultValue: "Queued for install…" })
                  : t("install.running_title", { defaultValue: "Installing server…" })}
            </span>
            <span className="text-muted-foreground text-xs">
              {isFailed
                ? t("install.failed_subtitle", {
                    defaultValue:
                      "The install script exited with a non-zero status. Review the log below and retry once the issue is fixed.",
                  })
                : t("install.running_subtitle", {
                    defaultValue:
                      "Pulling the install image and running the blueprint's setup script. This can take several minutes for large modpacks.",
                  })}
            </span>
          </div>
        </div>
        {isFailed ? (
          <Button
            size="sm"
            disabled={reinstall.isPending}
            onClick={() =>
              reinstall.mutate({ keepFiles: true, snapshotFirst: false })
            }
          >
            {reinstall.isPending
              ? t("install.retrying", { defaultValue: "Retrying…" })
              : t("install.retry", { defaultValue: "Retry install" })}
          </Button>
        ) : null}
      </header>

      <div
        ref={scrollRef}
        className="border-border bg-[#0e0e0e] text-zinc-300 min-h-0 flex-1 overflow-auto rounded-lg border font-mono text-[11px] leading-relaxed"
      >
        {log.length === 0 ? (
          <div className="text-muted-foreground p-3 text-xs">
            {t("install.waiting_for_output", {
              defaultValue: "Waiting for install output…",
            })}
          </div>
        ) : (
          <pre className="m-0 whitespace-pre-wrap break-all p-3">
            {log
              .map((l) => (l.stream === "stderr" ? `! ${l.line}` : l.line))
              .join("\n")}
          </pre>
        )}
      </div>
    </motion.div>
  )
}

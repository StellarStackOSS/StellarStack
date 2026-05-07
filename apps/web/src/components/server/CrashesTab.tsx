import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardHeader,
  CardInner,
  CardTitle,
} from "@workspace/ui/components/card"

import { useServerLayout } from "@/components/ServerLayoutContext"
import { useServerCrashes } from "@/hooks/useServerCrashes"
import type { CrashEntry } from "@/hooks/useServerCrashes.types"

const PAGE_SIZE = 25

const formatExit = (entry: CrashEntry, t: (k: string, opts?: object) => string): string => {
  if (entry.oomKilled) return t("crashes.cause.oom", { defaultValue: "Out of memory" })
  if (entry.signal !== null && entry.signal.length > 0) {
    return t("crashes.cause.signal", {
      defaultValue: "Killed by {{signal}}",
      signal: entry.signal,
    })
  }
  return t("crashes.cause.exit_code", {
    defaultValue: "Exit code {{code}}",
    code: entry.exitCode,
  })
}

const formatRelative = (iso: string): string => {
  const diff = Date.now() - Date.parse(iso)
  const s = Math.max(1, Math.floor(diff / 1000))
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export const CrashesTab = () => {
  const { t } = useTranslation()
  const { server } = useServerLayout()
  const [offset, setOffset] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)
  const { data, isLoading } = useServerCrashes(server.id, offset)
  const entries = data?.entries ?? []
  const total = data?.total ?? 0

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>
            {t("crashes.title", { defaultValue: "Crash reports" })}
          </CardTitle>
        </CardHeader>
        <CardInner className="flex flex-col gap-2 p-3">
          {isLoading ? (
            <p className="text-muted-foreground text-xs">
              {t("crashes.loading", { defaultValue: "Loading…" })}
            </p>
          ) : entries.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              {t("crashes.empty", {
                defaultValue: "No crashes recorded. Containers that exit cleanly aren't logged here.",
              })}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {entries.map((e) => {
                const expanded = openId === e.id
                return (
                  <li
                    key={e.id}
                    className="border-border rounded border px-3 py-2"
                  >
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 text-left"
                      onClick={() => setOpenId(expanded ? null : e.id)}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="text-destructive text-xs font-medium">
                          {formatExit(e, t)}
                        </span>
                        <span className="text-muted-foreground text-[0.65rem]">
                          {new Date(e.occurredAt).toLocaleString()} ·{" "}
                          {formatRelative(e.occurredAt)}
                        </span>
                      </div>
                      <span className="text-muted-foreground text-xs">
                        {expanded ? "▾" : "▸"}
                      </span>
                    </button>
                    {expanded ? (
                      <pre className="bg-muted mt-2 max-h-96 overflow-auto rounded p-2 font-mono text-[0.65rem] leading-relaxed text-zinc-200">
                        {e.logTail.length > 0
                          ? e.logTail
                          : t("crashes.no_logs", {
                              defaultValue: "(no logs captured)",
                            })}
                      </pre>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </CardInner>
      </Card>

      {total > PAGE_SIZE ? (
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-xs">
            {t("crashes.showing", {
              defaultValue: "{{from}}–{{to}} of {{total}}",
              from: offset + 1,
              to: Math.min(offset + entries.length, total),
              total,
            })}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              {t("actions.prev", { defaultValue: "Prev" })}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={offset + entries.length >= total}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              {t("actions.next", { defaultValue: "Next" })}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

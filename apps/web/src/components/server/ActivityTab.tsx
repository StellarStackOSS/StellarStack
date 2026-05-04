import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardInner,
  CardTitle,
} from "@workspace/ui/components/card"

import { useServerLayout } from "@/components/ServerLayoutContext"
import { useServerActivity } from "@/hooks/useServerActivity"
import type { ActivityEntry } from "@/hooks/useServerActivity.types"

const limit = 25

export const ActivityTab = () => {
  const { t } = useTranslation()
  const { server } = useServerLayout()

  const [offset, setOffset] = useState(0)
  const { data, isLoading } = useServerActivity(server.id, offset)
  const entries: ActivityEntry[] = data?.entries ?? []

  return (
    <div className="flex flex-col gap-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{t("activity.title")}</CardTitle>
        </CardHeader>
        <CardInner className="p-3">
          <p className="text-sm text-muted-foreground">{t("activity.description")}</p>
        </CardInner>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("activity.history_heading")}</CardTitle>
        </CardHeader>
        <CardInner className="p-3 flex flex-col gap-3">
          {isLoading ? (
            <p className="text-muted-foreground text-xs">{t("activity.loading")}</p>
          ) : entries.length === 0 ? (
            <p className="text-muted-foreground text-xs">{t("activity.empty")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {entries.map((entry) => {
                // The audit code is a translation key (e.g.
                // `servers.power.start`); the wire never carries
                // English. defaultValue surfaces the raw code if a
                // translation is missing so the row stays readable.
                const label = t(`audit.${entry.action}`, {
                  defaultValue: entry.action,
                  ns: "common",
                })
                return (
                  <li
                    key={entry.id}
                    className="border-border flex flex-col gap-1 rounded border px-3 py-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-zinc-200">{label}</span>
                      <span className="text-muted-foreground shrink-0 font-mono text-[0.65rem]">
                        {new Date(entry.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {entry.actorId !== null && (
                      <p className="text-muted-foreground font-mono">
                        {entry.actorId.slice(0, 8)}…
                      </p>
                    )}
                    {entry.metadata !== null && (
                      <p className="text-muted-foreground">
                        {Object.entries(entry.metadata)
                          .map(([k, v]) => `${k}=${String(v)}`)
                          .join(" · ")}
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          <div className="flex items-center justify-between pt-1">
            <span className="text-muted-foreground text-xs">
              {t("activity.pagination", {
                from: offset + 1,
                to: offset + entries.length,
              })}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={offset === 0}
                onClick={() => setOffset((prev) => Math.max(0, prev - limit))}
              >
                {t("activity.prev")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={entries.length < limit}
                onClick={() => setOffset((prev) => prev + limit)}
              >
                {t("activity.next")}
              </Button>
            </div>
          </div>
          </CardInner>
      </Card>
    </div>
  )
}

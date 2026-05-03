import { useTranslation } from "react-i18next"

import {
  Card,
  CardDescription,
  CardHeader,
  CardInner,
  CardTitle,
} from "@workspace/ui/components/card"

import { useServerLayout } from "@/components/ServerLayoutContext"
import { useTransfers } from "@/hooks/useTransfers"
import type { TransferRow } from "@/hooks/useTransfers.types"

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

export const TransfersTab = () => {
  const { t } = useTranslation()
  const { server } = useServerLayout()
  const { data, isLoading } = useTransfers(server.id)
  const transfers = data?.transfers ?? []

  return (
    <div className="flex flex-col gap-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{t("transfers.title")}</CardTitle>
        </CardHeader>
        <CardInner className="p-3">
          <p className="text-sm text-muted-foreground">{t("transfers.description")}</p>
        </CardInner>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("transfers.history_heading")}</CardTitle>
          <CardDescription>{t("transfers.history_description")}</CardDescription>
        </CardHeader>
        <CardInner className="p-3">
          {isLoading ? (
            <p className="text-muted-foreground text-xs">{t("transfers.loading")}</p>
          ) : transfers.length === 0 ? (
            <p className="text-muted-foreground text-xs">{t("transfers.empty")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {transfers.map((tr) => (
                <li
                  key={tr.id}
                  className="border-border flex items-start justify-between rounded border px-3 py-2 text-xs"
                >
                  <div className="space-y-0.5">
                    <p className="font-medium">Transfer {tr.id.slice(0, 8)}</p>
                    <p className="text-muted-foreground">
                      {t("transfers.item.started", { date: new Date(tr.createdAt).toLocaleString() })}
                      {tr.completedAt !== null &&
                        ` · ${t("transfers.item.completed", { date: new Date(tr.completedAt).toLocaleString() })}`}
                    </p>
                    {tr.error !== null ? (
                      <p className="text-destructive">{tr.error}</p>
                    ) : null}
                  </div>
                  <div>{statusBadge(tr.status)}</div>
                </li>
              ))}
            </ul>
          )}
          </CardInner>
      </Card>
    </div>
  )
}

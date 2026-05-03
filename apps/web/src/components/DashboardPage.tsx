import { useTranslation } from "react-i18next"

import { ServerList } from "@/components/ServerList"
import { useServers } from "@/hooks/useServers"

export const DashboardPage = () => {
  const { t } = useTranslation()
  const serversQuery = useServers()

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-base font-semibold">{t("dashboard.title")}</h1>
        <p className="text-muted-foreground text-xs">{t("dashboard.description")}</p>
      </header>
      <ServerList
        servers={serversQuery.data?.servers ?? []}
        loading={serversQuery.isLoading}
        emptyMessage={t("dashboard.empty")}
      />
    </div>
  )
}

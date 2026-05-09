import { useTranslation } from "react-i18next"

import { ServerList } from "@/components/ServerList"
import { useServers } from "@/hooks/useServers"

export const DashboardPage = () => {
  const { t } = useTranslation()
  const serversQuery = useServers()

  return (
    <ServerList
      servers={serversQuery.data?.servers ?? []}
      loading={serversQuery.isLoading}
      emptyMessage={t("dashboard.empty")}
    />
  )
}

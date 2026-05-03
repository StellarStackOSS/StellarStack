import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { ChevronRight } from "lucide-react"

import type { ServerLifecycleState } from "@workspace/shared/events.types"
import { TextureBadge } from "@workspace/ui/components/texture-badge"

import type { ServerListProps } from "@/components/ServerList.types"

const statusVariant = (
  s: ServerLifecycleState
): "success" | "warning" | "destructive" | "secondary" => {
  if (s === "running") return "success"
  if (s === "starting" || s === "stopping") return "warning"
  return "secondary"
}

export const ServerList = ({
  servers,
  loading,
  emptyMessage,
}: ServerListProps) => {
  const { t } = useTranslation()

  if (loading) {
    return <p className="text-xs text-zinc-500">{t("server_list.loading")}</p>
  }
  if (servers.length === 0) {
    return (
      <p className="text-xs text-zinc-500">
        {emptyMessage ?? t("server_list.empty")}
      </p>
    )
  }
  return (
    <ul className="flex flex-col gap-3">
      {servers.map((server) => (
        <li key={server.id}>
          <Link
            to="/servers/$id"
            params={{ id: server.id }}
            className="group relative flex cursor-pointer items-center justify-between rounded-lg border border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] px-6 py-5 shadow-lg shadow-black/20 transition-all duration-300 select-none hover:scale-[1.005] hover:border-zinc-200/20"
          >
            <div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium uppercase tracking-wider text-zinc-100">
                  {server.name}
                </span>
                <TextureBadge variant={statusVariant(server.status)}>
                  {t(`lifecycle.${server.status}`, { ns: "common" })}
                </TextureBadge>
              </div>
              <div className="mt-1.5 flex items-center gap-3 text-xs text-zinc-500">
                <span>{server.memoryLimitMb} MB RAM</span>
                <span>·</span>
                <span>{server.cpuLimitPercent}% CPU</span>
                <span>·</span>
                <span>{server.diskLimitMb} MB Disk</span>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-zinc-600 transition-colors group-hover:text-zinc-400" />
          </Link>
        </li>
      ))}
    </ul>
  )
}

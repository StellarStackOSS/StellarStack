import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import type { ServerLifecycleState } from "@workspace/shared/events.types"

import type { ServerListProps } from "@/components/ServerList.types"

const stateDot: Record<ServerLifecycleState, string> = {
  installing: "bg-chart-2",
  installed_stopped: "bg-muted-foreground",
  starting: "bg-chart-2",
  running: "bg-chart-1",
  stopping: "bg-chart-2",
  stopped: "bg-muted-foreground",
  crashed: "bg-destructive",
}

/**
 * Render the user's servers as a navigable list. Status indicator colour
 * derives from the lifecycle state; the label text comes from the
 * `lifecycle.<state>` translation keys so locale switching works.
 */
export const ServerList = ({
  servers,
  loading,
  emptyMessage,
}: ServerListProps) => {
  const { t } = useTranslation()

  if (loading) {
    return (
      <p className="text-muted-foreground text-xs">Loading…</p>
    )
  }
  if (servers.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">
        {emptyMessage ?? "No servers yet."}
      </p>
    )
  }
  return (
    <ul className="flex flex-col gap-2">
      {servers.map((server) => (
        <li
          key={server.id}
          className="border-border bg-card text-card-foreground flex items-center justify-between rounded-md border px-3 py-2"
        >
          <div>
            <Link
              to="/servers/$id"
              params={{ id: server.id }}
              className="text-sm font-medium hover:underline"
            >
              {server.name}
            </Link>
            <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
              <span
                className={`size-1.5 rounded-full ${stateDot[server.status]}`}
              />
              <span>
                {t(`lifecycle.${server.status}`, { ns: "common" })}
              </span>
              <span>·</span>
              <span>
                {server.memoryLimitMb} MB · {server.cpuLimitPercent}% CPU ·{" "}
                {server.diskLimitMb} MB disk
              </span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}

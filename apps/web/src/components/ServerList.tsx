import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardInner,
  CardTitle,
} from "@workspace/ui/components/card"

import { ServerStatusBadge } from "@/components/ServerStatusBadge"
import type { ServerListProps } from "@/components/ServerList.types"

const GAME_COVERS = ["/games/minecraft-1.jpg", "/games/minecraft-2.jpg"]

const hashSeed = (s: string): number => {
  let h = 0
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

const gameImageUrl = (seed: string): string =>
  GAME_COVERS[hashSeed(seed) % GAME_COVERS.length] ?? GAME_COVERS[0]!

export const ServerList = ({
  servers,
  loading,
  emptyMessage,
}: ServerListProps) => {
  const { t } = useTranslation()

  if (loading) {
    return (
      <p className="text-muted-foreground text-xs">{t("server_list.loading")}</p>
    )
  }
  if (servers.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">
        {emptyMessage ?? t("server_list.empty")}
      </p>
    )
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {servers.map((server) => (
        <Link
          key={server.id}
          to="/servers/$id"
          params={{ id: server.id }}
          className="group block transition-transform duration-200 hover:scale-[1.005]"
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="truncate text-sm">{server.name}</CardTitle>
              <CardDescription className="truncate">
                {server.memoryLimitMb} MB · {server.cpuLimitPercent}% CPU ·{" "}
                {server.diskLimitMb} MB
              </CardDescription>
              <CardAction>
                <ServerStatusBadge status={server.status} />
              </CardAction>
            </CardHeader>
            <CardInner className="relative aspect-[4/1] overflow-hidden">
              <img
                src={gameImageUrl(server.blueprintId)}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 size-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
              {server.parentId !== null ? (
                <span className="absolute bottom-2 left-2 rounded-full bg-black/50 px-2 py-0.5 text-[0.6rem] font-medium uppercase tracking-wider text-white backdrop-blur">
                  {t("instances.parent_badge", { defaultValue: "Instance" })}
                </span>
              ) : null}
            </CardInner>
          </Card>
        </Link>
      ))}
    </div>
  )
}

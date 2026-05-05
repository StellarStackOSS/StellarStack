import { ChevronRight } from "lucide-react"

import { TextureBadge } from "@workspace/ui/components/texture-badge"

const rows = [
  {
    name: "VANILLA SMP",
    status: "running",
    badge: "success" as const,
    memory: "4096",
    cpu: "200",
    disk: "50000",
  },
  {
    name: "PIXELMON",
    status: "starting",
    badge: "warning" as const,
    memory: "8192",
    cpu: "400",
    disk: "100000",
  },
  {
    name: "CREATIVE",
    status: "offline",
    badge: "secondary" as const,
    memory: "2048",
    cpu: "100",
    disk: "20000",
    parent: true,
  },
  {
    name: "RUST · LONG",
    status: "running",
    badge: "success" as const,
    memory: "16384",
    cpu: "800",
    disk: "200000",
  },
]

export const ServerListDemo = () => {
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((server) => (
        <li key={server.name}>
          <div className="group relative flex cursor-pointer items-center justify-between rounded-lg border border-zinc-200/10 bg-[#0e0e0e] px-6 py-5 shadow-lg shadow-black/20 transition-all duration-300 select-none hover:scale-[1.005] hover:border-zinc-200/20">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium uppercase tracking-wider text-zinc-100">
                  {server.name}
                </span>
                <TextureBadge variant={server.badge}>{server.status}</TextureBadge>
                {server.parent ? (
                  <TextureBadge variant="secondary">Instance</TextureBadge>
                ) : null}
              </div>
              <div className="mt-1.5 flex items-center gap-3 text-xs text-zinc-500">
                <span>{server.memory} MB RAM</span>
                <span>·</span>
                <span>{server.cpu}% CPU</span>
                <span>·</span>
                <span>{server.disk} MB Disk</span>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-zinc-600 transition-colors group-hover:text-zinc-400" />
          </div>
        </li>
      ))}
    </ul>
  )
}

import type { ComponentProps } from "react"
import { HugeiconsIcon } from "@hugeicons/react"

type HugeIconNode = ComponentProps<typeof HugeiconsIcon>["icon"]
import {
  ComputerTerminal02Icon,
  CubeIcon,
  DashboardSquare02Icon,
  DocumentValidationIcon,
  EthernetPortIcon,
  FolderLibraryIcon,
  HardDriveIcon,
  Layers01Icon,
  ListViewIcon,
  PowerSocket01Icon,
  ServerStack02Icon,
  ShieldUserIcon,
} from "@hugeicons/core-free-icons"

import {
  Card,
  CardContent,
  CardHeader,
  CardInner,
  CardTitle,
} from "@workspace/ui/components/card"

type Feature = {
  icon: HugeIconNode
  title: string
  description: string
}

const features: Feature[] = [
  {
    icon: ComputerTerminal02Icon,
    title: "Browser-direct console",
    description:
      "Power, console, stats and command flow over a single per-server WebSocket. The API stays out of the live path so latency reads as native.",
  },
  {
    icon: DashboardSquare02Icon,
    title: "Live resource graphs",
    description:
      "CPU, memory, disk I/O, network charts streamed from the daemon's stats pump. Hover for the underlying value in the right unit.",
  },
  {
    icon: PowerSocket01Icon,
    title: "Power lifecycle",
    description:
      "Start / stop / restart / kill with a per-server lock. Restart holds the lock end-to-end so state transitions read cleanly.",
  },
  {
    icon: DocumentValidationIcon,
    title: "Blueprint readiness",
    description:
      "Starting → running is gated on the blueprint's console-done patterns, not a guess at \"container is up\". Falls back gracefully when none.",
  },
  {
    icon: FolderLibraryIcon,
    title: "Config-file patching",
    description:
      "Blueprints declare configFiles (server.properties, etc.) and the daemon rewrites them with the resolved env on every start. Port changes actually land.",
  },
  {
    icon: ServerStack02Icon,
    title: "Multi-node",
    description:
      "Pluggable Go daemon, HMAC-signed callbacks, fresh config pull on every power action. Run it on as many hosts as you want.",
  },
  {
    icon: HardDriveIcon,
    title: "Backups + restore",
    description:
      "Local + S3 destinations, per-server cap, archive / restore with progress. Schedules can drive them on a cron.",
  },
  {
    icon: FolderLibraryIcon,
    title: "File manager",
    description:
      "Browse, edit, upload, move, decompress (.zip / .tar / .tar.gz / .tgz / .gz). Monaco editor for content, paginated tables.",
  },
  {
    icon: Layers01Icon,
    title: "Server splitting",
    description:
      "Carve a parent's resource pool into child instances with their own containers. Memory / CPU / disk drawn from the parent's allocation.",
  },
  {
    icon: EthernetPortIcon,
    title: "Allocations + SFTP",
    description:
      "Per-server allocations with a primary, on-demand SFTP credentials minted by the panel, scoped to one server.",
  },
  {
    icon: ShieldUserIcon,
    title: "Subusers",
    description:
      "Grant fine-grained per-server permissions (console, files, sftp, control). Audit log records every action with actor, target, IP.",
  },
  {
    icon: CubeIcon,
    title: "Blueprints",
    description:
      "Egg-shaped blueprint format with variables, install scripts, lifecycle probes, and configFiles. Convert from Pterodactyl eggs in one shot.",
  },
  {
    icon: ListViewIcon,
    title: "EULA + crash detection",
    description:
      "The daemon scans console output for the canonical Minecraft EULA prompt and surfaces a one-click accept-and-restart modal in the panel.",
  },
]

export const Features = () => {
  return (
    <section id="features" className="flex flex-col gap-8">
      <header className="flex flex-col gap-2 text-center">
        <span className="text-xs font-medium uppercase tracking-[0.3em] text-zinc-500">
          Everything you'd expect, nothing in the way
        </span>
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Built for people who actually run servers
        </h2>
      </header>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <Card key={f.title} className="w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-zinc-200">
                <HugeiconsIcon icon={f.icon} className="size-4 shrink-0 text-zinc-400" />
                {f.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardInner className="p-3">
                <p className="text-xs leading-relaxed text-zinc-400">
                  {f.description}
                </p>
              </CardInner>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}

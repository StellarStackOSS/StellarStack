import type { ReactNode } from "react"

import { Reveal, RevealItem, RevealStagger } from "@/components/Reveal"
import { ConsoleDemo } from "@/components/ConsoleDemo"
import {
  CpuCardDemo,
  DiskCardDemo,
  MemoryCardDemo,
  NetworkCardDemo,
} from "@/components/StatCardDemos"
import { ServerStatusBadgeDemo } from "@/components/ServerStatusBadgeDemo"

type Feat = {
  title: string
  description: string
  preview: ReactNode
  span?: "wide" | "tall"
}

const InstallPreview = () => (
  <div className="font-mono flex flex-col gap-1 rounded-md border border-white/10 bg-black/60 p-3 text-[11px] leading-relaxed text-zinc-300">
    <span className="text-emerald-400">[StellarStack Daemon]: Pulling Docker container image...</span>
    <span>[install] curl -sL https://api.papermc.io/v2/...</span>
    <span>[install] Resolved version 1.21.4-build.182</span>
    <span>[install] {"  "}downloaded {"  "}88.3 MB</span>
    <span className="text-emerald-400">[StellarStack Daemon]: Installation succeeded ✓</span>
  </div>
)

const FilesPreview = () => (
  <div className="rounded-md border border-white/10 bg-black/60 p-3 text-[11.5px]">
    <div className="flex items-center justify-between border-b border-white/5 pb-2 text-zinc-500">
      <span>home</span>
      <span className="font-mono text-[10px]">12 files</span>
    </div>
    <ul className="mt-2 flex flex-col gap-1.5 text-zinc-300">
      {[
        ["plugins", "—"],
        ["world", "—"],
        ["server.properties", "1.4 KB"],
        ["eula.txt", "157 B"],
        ["bukkit.yml", "1.1 KB"],
      ].map(([name, size]) => (
        <li key={name} className="flex items-center justify-between font-mono">
          <span>{name}</span>
          <span className="text-zinc-500">{size}</span>
        </li>
      ))}
    </ul>
  </div>
)

const PoolBars = () => (
  <div className="flex flex-col gap-2 rounded-md border border-white/10 bg-black/60 p-3 text-[11px]">
    {[
      { label: "Memory", used: 60, color: "bg-blue-400" },
      { label: "CPU", used: 35, color: "bg-emerald-400" },
      { label: "Disk", used: 18, color: "bg-purple-400" },
    ].map((b) => (
      <div key={b.label} className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-zinc-400">
          <span>{b.label}</span>
          <span className="font-mono text-zinc-500">{b.used}% allocated</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded bg-white/5">
          <div className={`h-full ${b.color}`} style={{ width: `${b.used}%` }} />
        </div>
      </div>
    ))}
  </div>
)

const features: Feat[] = [
  {
    title: "Browser-direct console",
    description:
      "Every per-server WebSocket multiplexes power, console, stats and commands. The API stays out of the live path.",
    preview: <ConsoleDemo />,
    span: "wide",
  },
  {
    title: "Status that means something",
    description:
      "Starting → running is gated on the blueprint's console-done patterns. No more lying flags.",
    preview: (
      <div className="flex h-full flex-col items-start gap-3 rounded-md border border-white/10 bg-black/60 p-4">
        <span className="text-[10.5px] uppercase tracking-wider text-zinc-500">
          Live state
        </span>
        <ServerStatusBadgeDemo />
        <div className="font-mono mt-2 text-[10.5px] text-zinc-500">
          [Server thread/INFO]: Done (4.203s)! For help, type "help"
        </div>
      </div>
    ),
  },
  {
    title: "Live stats, not screenshots",
    description:
      "CPU, memory, network, disk I/O streamed from the daemon's stats pump. Hover for the underlying value.",
    preview: (
      <div className="grid gap-3 grid-cols-2">
        <CpuCardDemo />
        <MemoryCardDemo />
        <NetworkCardDemo />
        <DiskCardDemo />
      </div>
    ),
    span: "wide",
  },
  {
    title: "Server splitting",
    description:
      "Carve a parent's resource pool into child instances with their own containers and consoles.",
    preview: <PoolBars />,
  },
  {
    title: "File manager",
    description:
      "Browse, edit, upload, decompress (.zip / .tar / .tar.gz / .tgz / .gz). Monaco-powered editor for content.",
    preview: <FilesPreview />,
  },
  {
    title: "Install + reinstall",
    description:
      "Separate install container, persistent log, streaming overlay. Reinstall stops the runtime container first.",
    preview: <InstallPreview />,
    span: "wide",
  },
]

export const Features = () => {
  return (
    <section id="features" className="flex flex-col gap-14 py-32">
      <Reveal>
        <header className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
          <span className="inline-flex items-center rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-400">
            Features
          </span>
          <h2 className="text-balance text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Everything you'd expect, nothing in the way
          </h2>
          <p className="max-w-xl text-sm text-zinc-400">
            Power, files, stats, blueprints, splitting, audit. The boring,
            modern stack — only the bits we actually believe in.
          </p>
        </header>
      </Reveal>

      <RevealStagger className="mx-auto grid w-full max-w-6xl gap-4 px-4 md:grid-cols-3">
        {features.map((f) => (
          <RevealItem
            key={f.title}
            className={f.span === "wide" ? "md:col-span-2" : ""}
          >
            <FeatureCard feature={f} />
          </RevealItem>
        ))}
      </RevealStagger>
    </section>
  )
}

const FeatureCard = ({ feature }: { feature: Feat }) => (
  <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/8 bg-[#0c0c0c] transition-all hover:border-white/15">
    <div className="relative h-[260px] overflow-hidden border-b border-white/5">
      <div
        aria-hidden
        className="absolute inset-0 opacity-70 transition-transform duration-700 group-hover:scale-105"
        style={{
          backgroundImage: "url(/example.jpeg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-black/80"
      />
      <div className="relative flex h-full items-center justify-center p-6">
        <div className="w-full max-w-md">{feature.preview}</div>
      </div>
    </div>
    <div className="flex flex-col gap-2 p-6">
      <h3 className="text-base font-semibold text-white">{feature.title}</h3>
      <p className="text-sm leading-relaxed text-zinc-400">
        {feature.description}
      </p>
    </div>
  </div>
)

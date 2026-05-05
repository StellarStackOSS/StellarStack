import type { ReactNode } from "react"

import {
  Card,
  CardContent,
  CardHeader,
  CardInner,
  CardTitle,
} from "@workspace/ui/components/card"

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
  /** Background image used behind the preview. Files live in /public. */
  bg?: "orange" | "green" | "purple"
}

const bgImage = (bg: Feat["bg"]) => {
  switch (bg) {
    case "orange":
      return "/bg-orange.png"
    case "green":
      return "/bg-green.png"
    case "purple":
      return "/bg-purple.png"
    default:
      return "/example.jpeg"
  }
}

const InstallPreview = () => (
  <Card className="w-full">
    <CardHeader>
      <CardTitle style={{ fontSize: 11 }}>Install log</CardTitle>
    </CardHeader>
    <CardContent>
      <CardInner
        className="font-mono flex flex-col gap-1 p-3 leading-relaxed text-zinc-300"
        style={{ fontSize: 11 }}
      >
        <span className="text-emerald-400">[StellarStack Daemon]: Pulling Docker container image...</span>
        <span>[install] curl -sL https://api.papermc.io/v2/...</span>
        <span>[install] Resolved version 1.21.4-build.182</span>
        <span>[install] {"  "}downloaded {"  "}88.3 MB</span>
        <span className="text-emerald-400">[StellarStack Daemon]: Installation succeeded ✓</span>
      </CardInner>
    </CardContent>
  </Card>
)

const FilesPreview = () => (
  <Card className="w-full">
    <CardHeader>
      <CardTitle
        className="flex items-center justify-between gap-2"
        style={{ fontSize: 11 }}
      >
        <span>home</span>
        <span className="font-normal text-zinc-600" style={{ fontSize: 10 }}>
          12 files
        </span>
      </CardTitle>
    </CardHeader>
    <CardContent>
      <CardInner className="p-3" style={{ fontSize: 11 }}>
        <ul className="flex flex-col gap-1.5 text-zinc-300">
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
      </CardInner>
    </CardContent>
  </Card>
)

const PoolBars = () => (
  <Card className="w-full">
    <CardHeader>
      <CardTitle style={{ fontSize: 11 }}>Resource pool</CardTitle>
    </CardHeader>
    <CardContent>
      <CardInner
        className="flex flex-col gap-2 p-3"
        style={{ fontSize: 11 }}
      >
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
      </CardInner>
    </CardContent>
  </Card>
)

const StatusPreview = () => (
  <Card className="w-full">
    <CardHeader>
      <CardTitle style={{ fontSize: 11 }}>Live state</CardTitle>
    </CardHeader>
    <CardContent>
      <CardInner
        className="flex flex-col items-start gap-3 p-4"
        style={{ fontSize: 11 }}
      >
        <ServerStatusBadgeDemo />
        <div className="font-mono text-zinc-500" style={{ fontSize: 10.5 }}>
          [Server thread/INFO]: Done (4.203s)! For help, type "help"
        </div>
      </CardInner>
    </CardContent>
  </Card>
)

const features: Feat[] = [
  {
    title: "Browser-direct console",
    description:
      "Every per-server WebSocket multiplexes power, console, stats and commands. The API stays out of the live path.",
    preview: <ConsoleDemo />,
    span: "wide",
    bg: "purple",
  },
  {
    title: "Status that means something",
    description:
      "Starting → running is gated on the blueprint's console-done patterns. No more lying flags.",
    preview: <StatusPreview />,
    bg: "green",
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
    bg: "orange",
  },
  {
    title: "Server splitting",
    description:
      "Carve a parent's resource pool into child instances with their own containers and consoles.",
    preview: <PoolBars />,
    bg: "purple",
  },
  {
    title: "File manager",
    description:
      "Browse, edit, upload, decompress (.zip / .tar / .tar.gz / .tgz / .gz). Monaco-powered editor for content.",
    preview: <FilesPreview />,
    bg: "orange",
  },
  {
    title: "Install + reinstall",
    description:
      "Separate install container, persistent log, streaming overlay. Reinstall stops the runtime container first.",
    preview: <InstallPreview />,
    span: "wide",
    bg: "green",
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
          backgroundImage: `url(${bgImage(feature.bg)})`,
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

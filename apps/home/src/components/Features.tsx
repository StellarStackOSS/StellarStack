import type { ReactNode } from "react"

import {
  Card,
  CardHeader,
  CardInner,
  CardTitle,
} from "@workspace/ui/components/card"

import { Reveal, RevealItem, RevealStagger } from "@/components/Reveal"

type Feat = {
  title: string
  description: string
  bg: "orange" | "green" | "purple"
  preview: ReactNode
  span?: "wide"
}

const bgImage = (bg: Feat["bg"]) =>
  bg === "orange"
    ? "/bg-orange.png"
    : bg === "green"
      ? "/bg-green.png"
      : "/bg-purple.png"

// ---------------------------------------------------------------------------
// Mock previews — built from @workspace/ui Card primitives so they read as
// the same surface the panel uses (CardHeader / CardInner / CardTitle).
// ---------------------------------------------------------------------------

const ConsolePreview = () => (
  <Card className="w-full max-w-sm shadow-2xl">
    <CardHeader>
      <CardTitle className="flex items-center justify-between gap-2 text-[11px]">
        <span>Console</span>
        <span className="rounded-sm bg-[#282532] px-1.5 py-0.5 text-[9px] font-medium text-[#A397E8]">
          Ask AI
        </span>
      </CardTitle>
    </CardHeader>
    <CardInner className="space-y-1 p-3 font-mono text-[11px] leading-relaxed text-zinc-300">
      <div>
        <span className="text-zinc-600">02:15:54 </span>
        Done preparing level "world" (4.157s)
      </div>
      <div className="text-orange-300">
        <span className="text-zinc-600">02:15:55 </span>
        WARN: Plugin LuckPerms needs Java 21
      </div>
      <div>
        <span className="text-zinc-600">02:15:55 </span>
        [INFO] For help, type "help"
      </div>
    </CardInner>
  </Card>
)

const StatusPreview = () => (
  <Card className="w-full max-w-sm shadow-2xl">
    <CardHeader>
      <CardTitle className="text-[11px]">Live state</CardTitle>
    </CardHeader>
    <CardInner className="flex flex-col items-start gap-3 p-4">
      <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-1 text-[10.5px] font-medium uppercase tracking-wider text-emerald-400">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          className="size-3"
        >
          <path
            d="M5 13l4 4L19 7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Online
      </span>
      <div className="font-mono text-[10.5px] text-zinc-500">
        Done (4.203s)! For help, type "help"
      </div>
    </CardInner>
  </Card>
)

const StatTile = ({ label, value }: { label: string; value: string }) => (
  <Card className="w-full">
    <CardHeader>
      <CardTitle className="text-[10px]">{label}</CardTitle>
    </CardHeader>
    <CardInner className="px-3 py-2 font-mono text-xs text-white">
      {value}
    </CardInner>
  </Card>
)

const StatsPreview = () => (
  <div className="grid w-full max-w-sm grid-cols-2 gap-2">
    <StatTile label="CPU" value="9.4%" />
    <StatTile label="Memory" value="779 MB" />
    <StatTile label="Disk I/O" value="0 B/s" />
    <StatTile label="Network" value="0 B/s" />
  </div>
)

const PoolPreview = () => (
  <Card className="w-full max-w-sm shadow-2xl">
    <CardHeader>
      <CardTitle className="text-[11px]">Resource pool</CardTitle>
    </CardHeader>
    <CardInner className="flex flex-col gap-2 p-3 font-mono text-[10px]">
      {[
        { label: "Memory", used: 60 },
        { label: "CPU", used: 35 },
        { label: "Disk", used: 18 },
      ].map((b) => (
        <div key={b.label} className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-zinc-400">
            <span>{b.label}</span>
            <span className="text-zinc-500">{b.used}% allocated</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded bg-white/5">
            <div
              className="h-full bg-white/40"
              style={{ width: `${b.used}%` }}
            />
          </div>
        </div>
      ))}
    </CardInner>
  </Card>
)

const FilesPreview = () => (
  <Card className="w-full max-w-sm shadow-2xl">
    <CardHeader>
      <CardTitle className="flex items-center justify-between gap-2 text-[11px]">
        <span>home</span>
        <span className="font-normal text-zinc-600 text-[10px]">12 files</span>
      </CardTitle>
    </CardHeader>
    <CardInner className="p-3">
      <ul className="flex flex-col gap-1.5 font-mono text-[11px] text-zinc-300">
        {[
          ["plugins", "—"],
          ["world", "—"],
          ["server.properties", "1.4 KB"],
          ["eula.txt", "157 B"],
          ["bukkit.yml", "1.1 KB"],
        ].map(([name, size]) => (
          <li key={name} className="flex items-center justify-between">
            <span>{name}</span>
            <span className="text-zinc-500">{size}</span>
          </li>
        ))}
      </ul>
    </CardInner>
  </Card>
)

const features: Feat[] = [
  {
    title: "AI built into the console",
    description:
      "Crash logs, plugin conflicts, weird config errors — paste a question, get an answer. The Ask AI button reads the last 100 lines as context.",
    bg: "purple",
    span: "wide",
    preview: <ConsolePreview />,
  },
  {
    title: "Status that means something",
    description:
      "Starting → running is gated on the blueprint's console-done patterns. No more lying flags.",
    bg: "green",
    preview: <StatusPreview />,
  },
  {
    title: "Live stats, not screenshots",
    description:
      "CPU, memory, network, disk I/O streamed from the daemon's stats pump. Hover for the underlying value.",
    bg: "orange",
    preview: <StatsPreview />,
  },
  {
    title: "Server splitting",
    description:
      "Carve a parent's resource pool into child instances with their own containers and consoles.",
    bg: "purple",
    preview: <PoolPreview />,
  },
  {
    title: "File manager + SFTP",
    description:
      "Browse, edit (Monaco), upload, decompress (.zip / .tar / .tar.gz). Browser-direct, JWT-gated.",
    bg: "orange",
    preview: <FilesPreview />,
  },
]

export const Features = () => (
  <section
    id="features"
    className="mx-auto flex w-[min(1200px,92vw)] flex-col gap-14 py-32"
  >
    <Reveal>
      <header className="flex max-w-2xl flex-col gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#A397E8]">
          Features
        </p>
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Everything you'd expect, nothing in the way
        </h2>
        <p className="text-sm font-extralight text-zinc-400">
          Power, files, stats, blueprints, splitting, audit. The boring,
          modern stack — only the bits we actually believe in.
        </p>
      </header>
    </Reveal>

    <RevealStagger className="grid gap-4 md:grid-cols-3">
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

const FeatureCard = ({ feature }: { feature: Feat }) => (
  <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/8 bg-[#201c19] transition-all hover:border-white/15">
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
        {feature.preview}
      </div>
    </div>
    <div className="flex flex-col gap-2 p-6">
      <h3 className="text-base font-semibold">{feature.title}</h3>
      <p className="text-sm font-extralight leading-relaxed text-zinc-400">
        {feature.description}
      </p>
    </div>
  </div>
)

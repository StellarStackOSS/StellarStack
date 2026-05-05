import { ConsoleDemo } from "@/components/ConsoleDemo"
import {
  CpuCardDemo,
  DiskCardDemo,
  MemoryCardDemo,
  NetworkCardDemo,
} from "@/components/StatCardDemos"
import { ServerListDemo } from "@/components/ServerListDemo"

export const Showcase = () => {
  return (
    <section id="showcase" className="flex flex-col gap-12">
      <header className="flex flex-col gap-2 text-center">
        <span className="text-xs font-medium uppercase tracking-[0.3em] text-zinc-500">
          Real components, mock data
        </span>
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
          What you actually see in the panel
        </h2>
        <p className="mx-auto max-w-2xl text-sm text-zinc-400">
          Everything below is the same React + Tailwind built into the panel,
          driven by mocked data here so you can see it in motion before you
          install anything.
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <CpuCardDemo />
        <MemoryCardDemo />
        <NetworkCardDemo />
        <DiskCardDemo />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ConsoleDemo />
        </div>
        <div className="flex flex-col gap-4 lg:col-span-2">
          <h3 className="text-sm font-medium uppercase tracking-wider text-zinc-400">
            Server list
          </h3>
          <ServerListDemo />
        </div>
      </div>
    </section>
  )
}

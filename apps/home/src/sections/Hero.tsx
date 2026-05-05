import { motion } from "framer-motion"

import { ConsoleDemo } from "@/components/ConsoleDemo"
import { ServerListDemo } from "@/components/ServerListDemo"
import { ServerStatusBadgeDemo } from "@/components/ServerStatusBadgeDemo"
import {
  CpuCardDemo,
  MemoryCardDemo,
  NetworkCardDemo,
} from "@/components/StatCardDemos"

export const Hero = () => {
  return (
    <section className="relative pt-20 pb-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[60vh] bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.06),transparent_60%)]"
      />
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
        }}
        className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center"
      >
        <motion.span
          variants={{
            hidden: { opacity: 0, y: 8 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
          }}
          className="inline-flex items-center rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-400"
        >
          Version 1.0
        </motion.span>
        <motion.h1
          variants={{
            hidden: { opacity: 0, y: 14 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
          }}
          className="text-balance text-5xl font-semibold leading-[1.05] tracking-tight text-white md:text-6xl"
        >
          Stop chasing servers.
          <br />
          <span className="text-zinc-400">Start running them.</span>
        </motion.h1>
        <motion.p
          variants={{
            hidden: { opacity: 0, y: 12 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
          }}
          className="max-w-xl text-balance text-base text-zinc-400 md:text-[17px]"
        >
          StellarStack is a self-hosted game-server panel — multi-node, blueprint-driven,
          with a browser-direct daemon socket. Power, console, files and stats in one
          place that's actually nice to live in.
        </motion.p>
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 8 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
          }}
          className="mt-2 flex flex-wrap items-center justify-center gap-3"
        >
          <a
            href="https://github.com/StellarStackOSS"
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-white/15 bg-white/5 px-5 py-2 text-sm font-medium text-zinc-200 transition-all hover:border-white/30 hover:bg-white/10"
          >
            Learn more
          </a>
          <a
            href="/register"
            className="group relative inline-flex items-center justify-center rounded-full bg-white px-5 py-2 text-sm font-medium text-black transition-all hover:scale-[1.02] hover:bg-zinc-100"
          >
            Get started
            <span className="ml-1.5 transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </a>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative mx-auto mt-16 max-w-6xl px-4"
      >
        {/* Textured backdrop bleeds out behind the card. example.jpeg
            is a soft cloud / cloth texture used as a placeholder. */}
        <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-black shadow-[0_30px_120px_-30px_rgba(0,0,0,0.9)]">
          <div
            aria-hidden
            className="absolute inset-0 -z-0 opacity-90"
            style={{
              backgroundImage: "url(/example.jpeg)",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          <div
            aria-hidden
            className="absolute inset-0 -z-0 bg-gradient-to-t from-black via-black/70 to-black/30"
          />
          <div className="relative grid gap-6 p-6 md:grid-cols-3">
            <div className="flex flex-col gap-4 md:col-span-2">
              <ConsoleDemo />
              <div className="grid gap-3 sm:grid-cols-3">
                <CpuCardDemo />
                <MemoryCardDemo />
                <NetworkCardDemo />
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                  Servers
                </span>
                <ServerStatusBadgeDemo />
              </div>
              <ServerListDemo />
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  )
}

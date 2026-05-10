import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown } from "lucide-react"

import { Reveal } from "@/components/Reveal"

const items = [
  {
    q: "Who is StellarStack for?",
    a: "Anyone hosting game servers — Minecraft, Source-engine, Rust, Factorio, anything that runs in a container. Self-host on your own boxes, your own bandwidth.",
  },
  {
    q: "How does it differ from Pterodactyl / Pelican?",
    a: "Same architecture (panel + daemon over a per-server WebSocket) but rebuilt with a modern stack. The UI is React + TypeScript instead of PHP, the daemon is Go, and AI is wired into the console out of the box.",
  },
  {
    q: "Can I run multiple nodes?",
    a: "Yes. The daemon is a single Go binary. Pair as many as you want — each node speaks to the API over HMAC-signed callbacks, the panel picks the right node per server.",
  },
  {
    q: "What's a blueprint?",
    a: "A JSON document describing a runtime: docker images, install script, env variables, configFile patches, lifecycle probes. You can convert any Pterodactyl egg into one with a single command.",
  },
  {
    q: "Is it free?",
    a: "Yes — MIT licensed and free to self-host. The panel + daemon are everything you need; there's nothing to pay for, no plans, no upsell.",
  },
  {
    q: "Is it ready to use?",
    a: "It's released and runnable in early access. Plenty of the headline features work (multi-node, blueprints, console, files, schedules, backups). It's still under active development, so expect rough edges and frequent releases — track the roadmap and changelog for what's landing.",
  },
]

export const Faq = () => (
  <section id="faq" className="mx-auto flex w-[min(1200px,92vw)] flex-col gap-14 py-32">
    <Reveal>
      <header className="flex max-w-2xl flex-col gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#A397E8]">
          FAQ
        </p>
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Frequently asked questions
        </h2>
      </header>
    </Reveal>
    <Reveal>
      <div className="flex w-full flex-col gap-2">
        {items.map((it) => (
          <FaqItem key={it.q} q={it.q} a={it.a} />
        ))}
      </div>
    </Reveal>
  </section>
)

const FaqItem = ({ q, a }: { q: string; a: string }) => {
  const [open, setOpen] = useState(false)
  return (
    <div className="overflow-hidden rounded-xl border border-white/8 bg-[#201c19]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-white/[0.02]"
      >
        <span className="text-sm font-medium">{q}</span>
        <ChevronDown
          className={`size-4 shrink-0 text-zinc-500 transition-transform duration-300 ${
            open ? "rotate-180 text-zinc-300" : ""
          }`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <p className="px-5 pb-4 text-sm font-extralight leading-relaxed text-zinc-400">
              {a}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

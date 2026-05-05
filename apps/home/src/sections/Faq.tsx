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
    q: "How does it differ from upstream panels?",
    a: "We rebuilt around a per-server WebSocket: power, console, stats and commands all flow over one socket the browser opens directly against the daemon. The API stays out of the live path so latency reads as native.",
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
    a: "Yes — MIT licensed. Code lives at github.com/StellarStackOSS.",
  },
]

export const Faq = () => {
  return (
    <section id="faq" className="flex flex-col gap-14 py-32">
      <Reveal>
        <header className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
          <span className="inline-flex items-center rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-400">
            FAQ
          </span>
          <h2 className="text-balance text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Frequently asked questions
          </h2>
        </header>
      </Reveal>
      <Reveal>
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-4">
          {items.map((it) => (
            <FaqItem key={it.q} q={it.q} a={it.a} />
          ))}
        </div>
      </Reveal>
    </section>
  )
}

const FaqItem = ({ q, a }: { q: string; a: string }) => {
  const [open, setOpen] = useState(false)
  return (
    <div className="overflow-hidden rounded-xl border border-white/8 bg-[#0c0c0c]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-white/[0.02]"
      >
        <span className="text-sm font-medium text-white">{q}</span>
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
            <p className="px-5 pb-4 text-sm leading-relaxed text-zinc-400">{a}</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

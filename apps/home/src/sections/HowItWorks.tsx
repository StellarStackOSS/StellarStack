import { Reveal, RevealItem, RevealStagger } from "@/components/Reveal"

const steps = [
  {
    n: "01",
    title: "Pair a node",
    description:
      "Run the Go daemon on any host, paste the pairing token from the admin area, and it joins your panel.",
  },
  {
    n: "02",
    title: "Pick a blueprint",
    description:
      "Paper, Velocity, Forge, anything — blueprints are just JSON with variables, configFiles and lifecycle probes.",
  },
  {
    n: "03",
    title: "Provision",
    description:
      "Allocations, memory, CPU and disk slice — the API runs the install script and streams logs into the panel.",
  },
  {
    n: "04",
    title: "Live it",
    description:
      "Power, console, files, schedules, backups, stats. One per-server WebSocket, no polling, no surprises.",
  },
]

export const HowItWorks = () => {
  return (
    <section id="how-it-works" className="flex flex-col gap-14 py-32">
      <Reveal>
        <header className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
          <span className="inline-flex items-center rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-400">
            How it works
          </span>
          <h2 className="text-balance text-3xl font-semibold tracking-tight text-white md:text-4xl">
            From a fresh node to a running server in four steps
          </h2>
        </header>
      </Reveal>

      <RevealStagger
        className="mx-auto grid w-full max-w-5xl gap-px overflow-hidden rounded-2xl border border-white/8 bg-white/5 px-px md:grid-cols-4"
        delay={0.08}
      >
        {steps.map((s) => (
          <RevealItem
            key={s.n}
            className="flex flex-col gap-3 bg-[#0c0c0c] p-6 transition-colors hover:bg-[#101010]"
          >
            <span className="font-mono text-[11px] tracking-widest text-zinc-500">
              {s.n}
            </span>
            <h3 className="text-base font-semibold text-white">{s.title}</h3>
            <p className="text-sm leading-relaxed text-zinc-400">
              {s.description}
            </p>
          </RevealItem>
        ))}
      </RevealStagger>
    </section>
  )
}

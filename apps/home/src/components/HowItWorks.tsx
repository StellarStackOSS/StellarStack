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
      "Paper, Velocity, Forge, Rust, Palworld — blueprints are JSON with variables, configFiles, and lifecycle probes.",
  },
  {
    n: "03",
    title: "Provision",
    description:
      "Allocations, memory, CPU, disk — the API runs the install script and streams logs into the panel.",
  },
  {
    n: "04",
    title: "Live it",
    description:
      "Power, console, files, schedules, backups, stats. One per-server WebSocket, no polling, no surprises.",
  },
]

export const HowItWorks = () => (
  <section id="how-it-works" className="mx-auto flex w-[min(1200px,92vw)] flex-col gap-14 py-32">
    <Reveal>
      <header className="flex max-w-2xl flex-col gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#A397E8]">
          How it works
        </p>
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
          From a fresh node to a running server in four steps
        </h2>
      </header>
    </Reveal>

    <RevealStagger
      className="grid gap-px overflow-hidden rounded-2xl border border-white/8 bg-white/5 px-px md:grid-cols-4"
      delay={0.08}
    >
      {steps.map((s) => (
        <RevealItem
          key={s.n}
          className="flex flex-col gap-3 bg-[#201c19] p-6 transition-colors hover:bg-[#26221f]"
        >
          <span className="font-mono text-[11px] tracking-widest text-zinc-500">
            {s.n}
          </span>
          <h3 className="text-base font-semibold">{s.title}</h3>
          <p className="text-sm font-extralight leading-relaxed text-zinc-400">
            {s.description}
          </p>
        </RevealItem>
      ))}
    </RevealStagger>
  </section>
)

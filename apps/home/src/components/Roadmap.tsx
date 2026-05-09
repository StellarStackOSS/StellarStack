import { Reveal, RevealItem, RevealStagger } from "@/components/Reveal"

type Status = "backlog" | "in-progress" | "in-review" | "deployed"

type Item = {
  title: string
  body: string
}

type Lane = {
  status: Status
  heading: string
  items: Item[]
}

const STATUS_LABEL: Record<Status, string> = {
  backlog: "Backlog",
  "in-progress": "In progress",
  "in-review": "In review",
  deployed: "Deployed",
}

const LANES: Lane[] = [
  {
    status: "backlog",
    heading: "Backlog",
    items: [
      {
        title: "Friend panels",
        body: "Link your panel to a friend's so they can manage your server without an account.",
      },
      {
        title: "Time-travel snapshots",
        body: "Hourly automatic world snapshots with one-click rollback for griefing recovery.",
      },
      {
        title: "Mobile-first console",
        body: "Native iOS / Android wrapper around the panel.",
      },
      {
        title: "Discord-style RSVP",
        body: "'We're playing tonight at 8' — server auto-starts, idles down 30 mins after last player leaves.",
      },
    ],
  },
  {
    status: "in-progress",
    heading: "In progress",
    items: [
      {
        title: "Public beta packaging",
        body: "Polishing the one-line installer, hardening the daemon's reconnect path, locking the v1 API surface.",
      },
      {
        title: "Hosted SaaS",
        body: "Multi-tenant panel, custom subdomains, billing via Stripe, managed Postgres + S3.",
      },
      {
        title: "2FA + passkeys",
        body: "TOTP and WebAuthn with backup codes. Already in the panel — sweeping the edges.",
      },
    ],
  },
  {
    status: "in-review",
    heading: "In review",
    items: [
      {
        title: "Database hosting",
        body: "Spin up Postgres / MySQL / Mongo containers per node, attach to game servers in one click.",
      },
      {
        title: "Plugin marketplace",
        body: "Community-curated blueprints, plugins, and config bundles installable from the panel.",
      },
      {
        title: "Crash fingerprinting",
        body: "Hash + anonymise stack traces; cross-reference fixes that worked for other users.",
      },
      {
        title: "Public server directory",
        body: "Opt-in browser of panel-hosted servers with player counts, tags, and banner art.",
      },
    ],
  },
  {
    status: "deployed",
    heading: "Deployed",
    items: [
      { title: "Core panel", body: "Auth, dashboard, blueprints, allocations." },
      { title: "Daemon + WS", body: "Per-server socket, power, console, stats, files." },
      { title: "Backups + restore", body: "Local + S3, lock, re-stream." },
      { title: "Schedules + tasks", body: "Cron syntax, power/command/backup actions." },
      { title: "Subusers + scopes", body: "Per-server JWT-gated access." },
      { title: "Audit log", body: "Every admin-impacting action recorded." },
      { title: "Crash reports", body: "Container exits captured with log tail." },
      { title: "AI in console", body: "Ask AI about errors, crashes, configs." },
    ],
  },
]

export const Roadmap = () => (
  <main className="mx-auto w-[min(1400px,96vw)] py-12 md:py-20">
    <Reveal>
      <header className="flex flex-col gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#A397E8]">
          Roadmap
        </p>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Where StellarStack is heading.
        </h1>
        <p className="max-w-2xl text-sm font-extralight leading-relaxed text-zinc-400 md:text-base">
          Public Kanban of what's shipped, what's in flight, and what's next.
          Scroll horizontally on small viewports — order within each lane is
          intent, not a hard sequence.
        </p>
      </header>
    </Reveal>

    {/* Kanban — 4 lanes, horizontal scroll on small viewports, full grid on desktop */}
    <div className="mt-12 -mx-4 overflow-x-auto px-4 pb-2 md:mx-0 md:overflow-visible md:px-0">
      <div className="grid auto-cols-[min(85vw,320px)] grid-flow-col gap-4 md:auto-cols-fr md:grid-cols-4">
        {LANES.map((lane, laneIndex) => (
          <Reveal key={lane.status} delay={laneIndex * 0.05}>
            <section className="flex h-full flex-col gap-3 rounded-2xl border border-white/8 bg-[#201c19] p-3">
              <header className="flex items-center justify-between gap-3 px-2 pt-2">
                <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-300">
                  {STATUS_LABEL[lane.status]}
                </h2>
                <span className="rounded-sm bg-[#282532] px-2 py-0.5 text-[10px] font-medium text-[#A397E8]">
                  {lane.items.length}
                </span>
              </header>

              <RevealStagger className="flex flex-col gap-2" delay={0.04}>
                {lane.items.map((item) => (
                  <RevealItem
                    key={item.title}
                    className="flex flex-col gap-1.5 rounded-md border border-white/5 bg-[#120F0C] p-3 transition-colors hover:border-white/10"
                  >
                    <h3 className="text-sm font-medium leading-snug">
                      {item.title}
                    </h3>
                    <p className="text-xs font-extralight leading-relaxed text-zinc-400">
                      {item.body}
                    </p>
                  </RevealItem>
                ))}
              </RevealStagger>
            </section>
          </Reveal>
        ))}
      </div>
    </div>
  </main>
)

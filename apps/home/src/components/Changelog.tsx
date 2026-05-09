import { motion } from "framer-motion"

const ease = [0.22, 1, 0.36, 1] as const

const fadeUpInView = (delay: number = 0) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.6, ease, delay },
})

type Tag = "feat" | "fix" | "ui" | "chore"

type Entry = {
  date: string
  tag: Tag
  title: string
  body?: string
}

const TAG_LABEL: Record<Tag, string> = {
  feat: "Feature",
  fix: "Fix",
  ui: "UI",
  chore: "Chore",
}

const TAG_COLOR: Record<Tag, string> = {
  feat: "bg-[#282532] text-[#A397E8]",
  fix: "bg-orange-500/15 text-orange-300",
  ui: "bg-emerald-500/15 text-emerald-300",
  chore: "bg-white/10 text-white/60",
}

const ENTRIES: Entry[] = [
  {
    date: "2026-05-09",
    tag: "ui",
    title: "Marketing landing v2",
    body: "Coming-soon landing rebuilt with Lay Grotesk, hero panel screenshot, features grid, FAQ, and changelog. Now you're reading it.",
  },
  {
    date: "2026-05-07",
    tag: "feat",
    title: "Crash reports with log tail",
    body: "Container exits while running are recorded as crash reports with the last few hundred log lines, surfaced under a server's Crashes tab.",
  },
  {
    date: "2026-05-06",
    tag: "fix",
    title: "Allocations default to 0.0.0.0",
    body: "New allocations were getting 127.0.0.1, which made the server unreachable from outside the host. Defaults now bind on all interfaces.",
  },
  {
    date: "2026-05-06",
    tag: "fix",
    title: "Daemon WS proxied through Caddy",
    body: "Browser dials the panel's TLS endpoint at /daemon/* and Caddy forwards to the local daemon. Mixed-content errors gone.",
  },
  {
    date: "2026-05-06",
    tag: "feat",
    title: "Better-auth admin plugin",
    body: "Roles, banning, impersonation backed by better-auth's admin plugin. First user signed up is bootstrapped as admin automatically.",
  },
  {
    date: "2026-05-05",
    tag: "feat",
    title: "One-line installer",
    body: "curl | bash style installer for full-stack, panel-only, and daemon-only modes. Bundles Postgres + Redis + Caddy into a single docker-compose.",
  },
  {
    date: "2026-05-05",
    tag: "ui",
    title: "Auto-scrolling stack strip",
    body: "Hero strip cycles through Minecraft, Rust, Palworld, Valheim, Garry's Mod and more — driven by the actual blueprint registry.",
  },
  {
    date: "2026-04-30",
    tag: "feat",
    title: "Streaming install overlay",
    body: "Install logs render live as the daemon runs. Reinstall stops the running container first, then re-runs the install script.",
  },
  {
    date: "2026-04-30",
    tag: "feat",
    title: "Standardised readiness via blueprints",
    body: "Console-done patterns + config-file patcher mean the same blueprint runs against vanilla, Paper, Forge, Velocity — and announces ready when the server actually is.",
  },
  {
    date: "2026-04-29",
    tag: "feat",
    title: "Hover tooltips on every sparkline",
    body: "CPU, memory, disk, network — all stat cards now expose live values + timestamps on hover. Memory is shown in MB instead of raw bytes.",
  },
  {
    date: "2026-04-28",
    tag: "ui",
    title: "Animated server status badge",
    body: "Running / starting / stopping / offline get an animated dot-matrix spinner + colour transition. Idle states stay calm; transitions feel alive.",
  },
  {
    date: "2026-04-28",
    tag: "feat",
    title: "⌘K command palette",
    body: "Cmd-K opens a fuzzy nav across every server tab and admin section. Keyboard-first navigation for the people who hate touching their mouse.",
  },
  {
    date: "2026-04-27",
    tag: "feat",
    title: "Decompress in the file manager",
    body: "Right-click → Extract on .zip, .tar, .tar.gz, .tgz, .gz. Runs on the daemon, streams progress back to the browser.",
  },
  {
    date: "2026-04-26",
    tag: "feat",
    title: "EULA acceptance modal",
    body: "Daemon detects EULA-required state, surfaces a modal in the panel that updates eula.txt and re-starts the server in one click.",
  },
  {
    date: "2026-04-25",
    tag: "feat",
    title: "Server splitting (Instances)",
    body: "Carve a parent server's resources into named child instances. Each gets its own quota, its own console, and its own port.",
  },
  {
    date: "2026-04-22",
    tag: "feat",
    title: "Audit log",
    body: "Every admin-impacting action lands in /admin/audit with actor, target, and metadata. Filterable by action, time, and actor.",
  },
  {
    date: "2026-04-20",
    tag: "feat",
    title: "Server transfers between nodes",
    body: "Daemon-to-daemon archive stream. The panel flips the server's nodeId once the destination confirms ingest.",
  },
  {
    date: "2026-04-18",
    tag: "feat",
    title: "Cron schedules + tasks",
    body: "Schedule power actions, RCON commands, and backups. Standard cron syntax, paused/resumed per schedule.",
  },
  {
    date: "2026-04-15",
    tag: "feat",
    title: "Subusers + permission scopes",
    body: "Invite teammates per server with granular scopes — console.read, files.write, backup.read, etc. Tokens are JWT-signed by the panel and verified by the daemon.",
  },
  {
    date: "2026-04-12",
    tag: "feat",
    title: "Backups (local + S3)",
    body: "One-click archives to local disk or any S3-compatible bucket. Restore, lock, and re-stream from the same UI.",
  },
  {
    date: "2026-04-10",
    tag: "feat",
    title: "File manager + SFTP",
    body: "Browser-direct file manager with edit-in-Monaco, drag-to-upload, and a JWT-gated SFTP daemon for the people who insist on sftp clients.",
  },
  {
    date: "2026-04-08",
    tag: "feat",
    title: "Live container stats",
    body: "Daemon streams CPU / memory / disk / network samples to the browser at 1Hz; sparklines render with no flicker thanks to a tiny ring buffer.",
  },
  {
    date: "2026-04-05",
    tag: "feat",
    title: "Power actions over the daemon WS",
    body: "Start / stop / restart / kill flow through a single per-server WebSocket. The console replays the last N lines on connect, no fresh tail needed.",
  },
  {
    date: "2026-04-02",
    tag: "feat",
    title: "Server provisioning end-to-end",
    body: "Pick a blueprint, pick a node, get a running server. Install runs on the daemon, panel polls progress, EULA modal pops if needed.",
  },
  {
    date: "2026-03-28",
    tag: "feat",
    title: "Blueprint CRUD + Minecraft seed",
    body: "Blueprints are first-class — create, edit, version, share. The Minecraft seed (Paper/Velocity/Forge) ships in the box.",
  },
  {
    date: "2026-03-25",
    tag: "feat",
    title: "Node enrollment + daemon pairing",
    body: "stellar-daemon configure pairs against a one-time token; the panel HMACs every subsequent request with the per-node key.",
  },
  {
    date: "2026-03-20",
    tag: "feat",
    title: "Web auth + dashboard",
    body: "Better-auth on the API side, server list + status dots on the panel, live updates over a panel-event WS.",
  },
  {
    date: "2026-03-15",
    tag: "chore",
    title: "Monorepo foundation",
    body: "TypeScript monorepo with apps/api, apps/web, apps/daemon, apps/home, packages/db, packages/shared, packages/ui. pnpm + Turbo + Vite.",
  },
]

export const Changelog = () => (
  <main className="mx-auto w-[min(800px,92vw)] py-12 md:py-20">
    <motion.div {...fadeUpInView()}>
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#A397E8]">
        Changelog
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
        What's shipping.
      </h1>
      <p className="mt-3 max-w-xl text-sm font-extralight leading-relaxed text-white/60 md:text-base">
        Public log of features, fixes, and UI work as we head toward the
        Q3 2026 beta. Pulled from the actual git history.
      </p>
    </motion.div>

    <div className="mt-12 flex flex-col gap-8">
      {ENTRIES.map((entry, i) => (
        <motion.article
          key={`${entry.date}-${entry.title}`}
          {...fadeUpInView(Math.min(i * 0.02, 0.2))}
          className="grid grid-cols-1 gap-3 border-t border-white/10 pt-6 md:grid-cols-[140px_1fr]"
        >
          <div className="flex flex-col gap-2">
            <span className="text-xs text-white/40">{entry.date}</span>
            <span
              className={`inline-flex w-fit items-center rounded-sm px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                TAG_COLOR[entry.tag]
              }`}
            >
              {TAG_LABEL[entry.tag]}
            </span>
          </div>
          <div>
            <h3 className="text-base font-medium">{entry.title}</h3>
            {entry.body !== undefined ? (
              <p className="mt-2 text-sm font-extralight leading-relaxed text-white/60">
                {entry.body}
              </p>
            ) : null}
          </div>
        </motion.article>
      ))}
    </div>
  </main>
)

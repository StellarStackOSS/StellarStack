import { useState } from "react"
import { Reveal } from "@/components/Reveal"

type Tab = "truenas" | "compose"

const COMPOSE_YAML = `services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    user: "568:568"
    environment:
      POSTGRES_USER: stellar
      POSTGRES_PASSWORD: changeme-postgres
      POSTGRES_DB: stellarstack
      PGDATA: /var/lib/postgresql/data/pgdata
    volumes:
      - /mnt/tank/apps/stellarstack/postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U stellar -d stellarstack"]
      interval: 5s
      timeout: 5s
      retries: 20

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    user: "568:568"
    command: ["redis-server", "--save", "60", "1", "--loglevel", "warning"]
    volumes:
      - /mnt/tank/apps/stellarstack/redis:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 20

  api:
    image: ghcr.io/stellarstackoss/api:latest
    pull_policy: always
    restart: unless-stopped
    depends_on:
      postgres: { condition: service_healthy }
      redis:    { condition: service_healthy }
    environment:
      NODE_ENV: production
      PORT: "3000"
      DATABASE_URL: postgresql://stellar:changeme-postgres@postgres:5432/stellarstack
      REDIS_URL: redis://redis:6379
      # REQUIRED: 32+ char hex string. Generate with: openssl rand -hex 32
      BETTER_AUTH_SECRET: changeme-32-bytes-of-random-hex-please
      APP_BASE_URL: http://stellarstack.local:30100
      API_BASE_URL: http://stellarstack.local:30100
    expose:
      - "3000"

  panel:
    image: ghcr.io/stellarstackoss/panel:latest
    pull_policy: always
    restart: unless-stopped
    depends_on:
      - api
    environment:
      VITE_API_URL: http://stellarstack.local:30100/api
      VITE_WS_URL:  ws://stellarstack.local:30100
    ports:
      - "30100:5173"

  daemon:
    image: ghcr.io/stellarstackoss/daemon:latest
    pull_policy: always
    restart: unless-stopped
    depends_on:
      - api
    environment:
      # OPTIONAL: paste the pairing token from "Admin → Nodes → Pair daemon".
      # Leave blank on first deploy; set it after creating the admin account.
      PAIRING_TOKEN: ""
      PANEL_URL: http://api:3000
    volumes:
      - /mnt/tank/apps/stellarstack/daemon:/var/lib/stellarstack
      - /mnt/tank/apps/stellarstack/servers:/var/lib/stellarstack/servers
      - /var/run/docker.sock:/var/run/docker.sock
    ports:
      - "25565:25565/tcp"     # Minecraft Java default
      - "19132:19132/udp"     # Minecraft Bedrock default
`

const STEPS_TRUENAS = [
  "Create a dataset for StellarStack data in your TrueNAS UI (e.g. tank/apps/stellarstack)",
  "Set dataset ACL permissions: User 568, Group 568",
  "Open the TrueNAS web UI and go to Apps",
  "Click Discover Apps (top-right)",
  "Click the 3 dots in the top right",
  "Select Install via YAML",
  "Paste the YAML on the right into the editor",
  "Update /mnt/tank/apps/stellarstack to your dataset path (four occurrences)",
  "Replace changeme-postgres with a secure DB password",
  "Replace BETTER_AUTH_SECRET with a 32-byte random hex (openssl rand -hex 32)",
  "Update APP_BASE_URL / API_BASE_URL to your hostname (or TrueNAS IP)",
  "Click Save and wait ~90s for images to pull",
  "Panel will be available at http://your-truenas-ip:30100",
  "Sign up, then Admin → Nodes → Pair daemon → paste token into PAIRING_TOKEN env var, redeploy",
]

const STEPS_COMPOSE = [
  "Save the YAML on the right as docker-compose.yml in an empty folder",
  "Edit volume paths — replace /mnt/tank/apps/stellarstack with wherever you want the data to live",
  "Replace the two changeme placeholders (Postgres password + BETTER_AUTH_SECRET)",
  "Update APP_BASE_URL / API_BASE_URL to your domain or LAN IP",
  "Run: docker compose pull && docker compose up -d",
  "Open the panel URL in your browser, create the admin account",
  "Admin → Nodes → Pair daemon → copy the token",
  "Set PAIRING_TOKEN in the compose file, then: docker compose up -d daemon",
]

export const TrueNAS = () => {
  const [tab, setTab] = useState<Tab>("truenas")
  const [copied, setCopied] = useState(false)
  const steps = tab === "truenas" ? STEPS_TRUENAS : STEPS_COMPOSE

  const copy = async () => {
    await navigator.clipboard.writeText(COMPOSE_YAML)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <main className="pt-28 pb-24">
      <div className="mx-auto w-[min(1200px,94vw)]">
        <Reveal className="flex flex-col gap-3">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
            Install guide
          </p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            StellarStack on TrueNAS SCALE
          </h1>
          <p className="max-w-2xl text-sm text-zinc-400 md:text-base">
            The full stack as a single Custom App. Panel, API, Postgres,
            Redis, and the daemon in one YAML — about 5 minutes from a
            fresh dataset to a running panel.
          </p>
        </Reveal>

        <div className="mt-10 flex items-center gap-1 border-b border-white/10">
          <Tab
            label="TrueNAS Custom App"
            active={tab === "truenas"}
            onClick={() => setTab("truenas")}
          />
          <Tab
            label="Docker Compose"
            active={tab === "compose"}
            onClick={() => setTab("compose")}
          />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {/* Left — Steps */}
          <Reveal className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
            <h2 className="text-base font-semibold tracking-tight">Steps</h2>
            <ol className="mt-5 flex flex-col gap-2.5 text-sm text-zinc-300">
              {steps.map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#A397E8]" />
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </Reveal>

          {/* Right — YAML with copy */}
          <Reveal className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
            <div className="flex items-center justify-between border-b border-white/5 px-5 py-3">
              <span className="font-mono text-xs text-zinc-400">
                compose.yaml
              </span>
              <button
                onClick={copy}
                className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/[0.08] hover:text-white"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <pre className="max-h-[640px] overflow-auto px-5 py-4 font-mono text-[11.5px] leading-snug text-zinc-300">
              <code>{COMPOSE_YAML}</code>
            </pre>
          </Reveal>
        </div>

        <Reveal className="mt-10 text-xs text-zinc-500">
          TrueNAS SCALE 24.10+ recommended (Docker-based apps). Older
          versions used k3s and won't run this template. Game-port
          allocations created in the panel need a matching{" "}
          <code className="rounded bg-white/5 px-1.5 py-0.5">ports:</code>{" "}
          entry on the daemon service.
        </Reveal>
      </div>
    </main>
  )
}

const Tab = ({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) => (
  <button
    onClick={onClick}
    className={`relative px-4 py-3 text-sm transition-colors ${
      active ? "text-white" : "text-zinc-500 hover:text-zinc-300"
    }`}
  >
    {label}
    {active ? (
      <span className="absolute inset-x-3 -bottom-px h-px bg-white" />
    ) : null}
  </button>
)

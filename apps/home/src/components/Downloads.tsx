import { Reveal } from "@/components/Reveal"

const RELEASE_BASE =
  "https://github.com/StellarStackOSS/StellarStack/releases/latest/download"

type Platform = {
  os: "macOS" | "Windows" | "Linux"
  icon: string
  builds: { label: string; arch: string; href: string; size?: string }[]
}

const PLATFORMS: Platform[] = [
  {
    os: "macOS",
    icon: "",
    builds: [
      {
        label: "Apple Silicon (M-series)",
        arch: "arm64",
        href: `${RELEASE_BASE}/StellarStack-mac-arm64.dmg`,
      },
      {
        label: "Intel",
        arch: "x64",
        href: `${RELEASE_BASE}/StellarStack-mac-x64.dmg`,
      },
    ],
  },
  {
    os: "Windows",
    icon: "",
    builds: [
      {
        label: "Windows 10/11",
        arch: "x64",
        href: `${RELEASE_BASE}/StellarStack-win-x64.exe`,
      },
      {
        label: "Windows on ARM",
        arch: "arm64",
        href: `${RELEASE_BASE}/StellarStack-win-arm64.exe`,
      },
    ],
  },
  {
    os: "Linux",
    icon: "",
    builds: [
      {
        label: "AppImage (x86_64)",
        arch: "x64",
        href: `${RELEASE_BASE}/StellarStack-linux-x64.AppImage`,
      },
      {
        label: "AppImage (ARM64)",
        arch: "arm64",
        href: `${RELEASE_BASE}/StellarStack-linux-arm64.AppImage`,
      },
    ],
  },
]

export const Downloads = () => (
  <main className="pt-28 pb-24">
    <div className="mx-auto w-[min(1100px,92vw)]">
      <Reveal className="flex flex-col gap-4">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
          Desktop client
        </p>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Download StellarStack
        </h1>
        <p className="max-w-2xl text-sm text-zinc-400 md:text-base">
          The full panel, API, and daemon in a single installer. Bundles
          Postgres + Redis as managed containers — no compose files, no
          reverse proxy. MIT-licensed, free.
        </p>
      </Reveal>

      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {PLATFORMS.map((platform) => (
          <Reveal
            key={platform.os}
            className="rounded-xl border border-white/10 bg-white/[0.02] p-6"
          >
            <h2 className="text-lg font-semibold tracking-tight">
              {platform.os}
            </h2>
            <ul className="mt-5 flex flex-col gap-3">
              {platform.builds.map((build) => (
                <li key={build.arch}>
                  <a
                    href={build.href}
                    className="group flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.03] px-4 py-3 text-sm transition-colors hover:border-white/15 hover:bg-white/[0.06]"
                  >
                    <span className="flex flex-col">
                      <span className="font-medium text-white">
                        {build.label}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {build.arch}
                      </span>
                    </span>
                    <span className="text-xs font-medium text-zinc-400 group-hover:text-white">
                      Download
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </Reveal>
        ))}
      </div>

      <Reveal className="mt-16 rounded-xl border border-white/5 bg-white/[0.02] p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Before you install
        </h3>
        <ul className="mt-4 flex flex-col gap-3 text-sm text-zinc-300">
          <li>
            <span className="font-medium text-white">Docker is required.</span>{" "}
            The desktop client manages two containers (Postgres + Redis) for
            you, but it needs a Docker runtime installed. Docker Desktop,
            Colima, OrbStack, Rancher Desktop, and Podman all work.
          </li>
          <li>
            <span className="font-medium text-white">First-time setup is
            roughly two minutes.</span>{" "}
            The app detects your Docker runtime, spins up the database, runs
            migrations, seeds the blueprint catalog, and asks for an email +
            password. Then it drops you straight into the panel.
          </li>
          <li>
            <span className="font-medium text-white">macOS first launch:</span>{" "}
            the build is unsigned (no Apple Developer ID). Drag the app to
            Applications, then <em>right-click → Open</em> the first time
            and click "Open" on the dialog. After that it launches
            normally.
          </li>
          <li>
            <span className="font-medium text-white">Windows SmartScreen:</span>{" "}
            click "More info" → "Run anyway" if Windows flags the
            installer as unrecognised. Same root cause as macOS — we
            don't pay for an EV cert yet.
          </li>
          <li>
            <span className="font-medium text-white">Prefer to self-host?</span>{" "}
            The desktop client is the same code as the server build, just
            bundled. If you want to run on a Linux box behind a reverse
            proxy, check the{" "}
            <a
              href="https://github.com/StellarStackOSS/StellarStack"
              className="underline decoration-zinc-500 underline-offset-4 hover:decoration-white"
            >
              repo
            </a>{" "}
            for the production install path.
          </li>
        </ul>
      </Reveal>

      <Reveal className="mt-8 text-xs text-zinc-500">
        Source on{" "}
        <a
          href="https://github.com/StellarStackOSS/StellarStack"
          className="underline decoration-zinc-700 underline-offset-4 hover:decoration-white hover:text-white"
        >
          GitHub
        </a>
        . Builds are produced by GitHub Actions, signed where the platform
        requires it, and published to the{" "}
        <a
          href="https://github.com/StellarStackOSS/StellarStack/releases"
          className="underline decoration-zinc-700 underline-offset-4 hover:decoration-white hover:text-white"
        >
          releases page
        </a>
        .
      </Reveal>
    </div>
  </main>
)

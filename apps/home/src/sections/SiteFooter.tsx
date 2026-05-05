import { Reveal } from "@/components/Reveal"

const linkGroups = [
  {
    heading: "Product",
    links: [
      { label: "How it works", href: "#how-it-works" },
      { label: "Features", href: "#features" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    heading: "Pages",
    links: [
      { label: "Sign in", href: "/login" },
      { label: "Sign up", href: "/register" },
      { label: "Dashboard", href: "/dashboard" },
    ],
  },
  {
    heading: "Open source",
    links: [
      { label: "GitHub", href: "https://github.com/StellarStackOSS" },
      { label: "Planets", href: "https://github.com/StellarStackOSS/StellarStack-Planets" },
    ],
  },
]

export const SiteFooter = () => {
  return (
    <footer className="border-t border-white/5">
      <Reveal>
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-16 px-6 pt-20 pb-10">
          <div className="grid gap-12 md:grid-cols-[1fr_auto_auto_auto]">
            <div className="flex flex-col gap-3">
              <a href="#" className="flex items-center gap-2">
                <span className="bg-white/[0.06] flex aspect-square size-7 items-center justify-center rounded-md text-[11px] font-bold text-white">
                  S
                </span>
                <span className="text-sm font-semibold tracking-tight text-white">
                  StellarStack
                </span>
              </a>
              <p className="max-w-sm text-xs leading-relaxed text-zinc-500">
                A self-hosted game-server panel — multi-node, blueprint-driven,
                browser-direct daemon socket. MIT licensed.
              </p>
            </div>
            {linkGroups.map((g) => (
              <div key={g.heading} className="flex flex-col gap-3">
                <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                  {g.heading}
                </span>
                <ul className="flex flex-col gap-2">
                  {g.links.map((l) => (
                    <li key={l.label}>
                      <a
                        href={l.href}
                        className="text-sm text-zinc-300 transition-colors hover:text-white"
                      >
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div
            aria-hidden
            className="select-none text-center font-semibold tracking-tighter text-white/[0.04]"
            style={{
              fontSize: "clamp(80px, 18vw, 240px)",
              lineHeight: 0.85,
            }}
          >
            StellarStack
          </div>

          <div className="flex flex-col items-center justify-between gap-3 border-t border-white/5 pt-6 text-xs text-zinc-500 md:flex-row">
            <span>© {new Date().getFullYear()} StellarStack. MIT.</span>
            <div className="flex items-center gap-5">
              <a href="#" className="transition-colors hover:text-zinc-200">
                Privacy
              </a>
              <a href="#" className="transition-colors hover:text-zinc-200">
                Terms
              </a>
              <a
                href="https://github.com/StellarStackOSS"
                target="_blank"
                rel="noreferrer"
                className="transition-colors hover:text-zinc-200"
              >
                GitHub
              </a>
            </div>
          </div>
        </div>
      </Reveal>
    </footer>
  )
}

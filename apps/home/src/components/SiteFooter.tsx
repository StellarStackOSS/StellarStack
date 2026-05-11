import type { MouseEvent } from "react"

import { Reveal } from "@/components/Reveal"

const HEADER_OFFSET = 80

const onAnchorClick = (e: MouseEvent<HTMLAnchorElement>) => {
  const href = e.currentTarget.getAttribute("href") ?? ""
  if (!href.startsWith("#") || href.startsWith("#/")) return
  const id = href.slice(1)
  if (id === "") return
  const el = document.getElementById(id)
  if (el === null) return
  e.preventDefault()
  const top =
    el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET
  window.scrollTo({ top, behavior: "smooth" })
  history.replaceState(null, "", href)
}

const linkGroups = [
  {
    heading: "Product",
    links: [
      { label: "FAQ", href: "#faq" },
      { label: "Blog", href: "#/blog" },
      { label: "Changelog", href: "#/changelog" },
      { label: "Roadmap", href: "#/roadmap" },
    ],
  },
  {
    heading: "Open source",
    links: [
      { label: "Open Collective", href: "https://opencollective.com/stellarstackoss" },
    ],
  },
  {
    heading: "Pages",
    links: [
      { label: "Privacy", href: "#/privacy" },
      { label: "Terms", href: "#/terms" },
      { label: "Waitlist", href: "#waitlist" },
    ],
  },
]

export const SiteFooter = () => (
  <footer className="border-t border-white/5">
    <Reveal>
      <div className="mx-auto flex w-[min(1200px,92vw)] flex-col gap-16 pt-20 pb-10">
        <div className="grid gap-12 md:grid-cols-[1fr_auto_auto_auto]">
          <div className="flex flex-col gap-3">
            <a href="#/" className="flex items-center gap-2">
              <img src="/logo.png" alt="" className="size-5 shrink-0" />
              <span className="text-sm font-semibold tracking-tight">
                StellarStack
              </span>
            </a>
            <p className="max-w-sm text-xs font-extralight leading-relaxed text-zinc-500">
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
                      onClick={onAnchorClick}
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
            fontSize: "clamp(40px, 16vw, 240px)",
            lineHeight: 0.85,
          }}
        >
          StellarStack
        </div>

        <div className="border-t border-white/5 pt-6 text-xs text-zinc-500">
          <span>&copy; {new Date().getFullYear()} StellarStack Inc. MIT.</span>
        </div>
      </div>
    </Reveal>
  </footer>
)

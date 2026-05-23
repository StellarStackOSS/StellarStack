import { AnimatePresence, motion } from "framer-motion"
import type { MouseEvent, ReactNode } from "react"
import { useEffect, useState } from "react"

import { useWaitlist } from "@/hooks/useWaitlist"

import { BlogList, BlogPostView } from "@/components/Blog"
import { Changelog } from "@/components/Changelog"
import { Downloads } from "@/components/Downloads"
import { TrueNAS } from "@/components/TrueNAS"
import { Faq } from "@/components/Faq"
import { Features } from "@/components/Features"
import { HowItWorks } from "@/components/HowItWorks"
import { Privacy, Terms } from "@/components/Legal"
import { Roadmap } from "@/components/Roadmap"
import { SiteFooter } from "@/components/SiteFooter"
import { StackStrip } from "@/components/StackStrip"

const ease = [0.22, 1, 0.36, 1] as const

// In-page anchor handler. Bypasses CSS `scroll-behavior` (unreliable with
// hash routers + sticky headers) and scrolls the target into view with a
// fixed top offset so the sticky header doesn't cover the heading.
const HEADER_OFFSET = 80

const smoothScrollTo = (href: string) => {
  if (!href.startsWith("#") || href.startsWith("#/")) return false
  const id = href.slice(1)
  if (id === "") return false
  const el = document.getElementById(id)
  if (el === null) return false
  const top =
    el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET
  window.scrollTo({ top, behavior: "smooth" })
  history.replaceState(null, "", href)
  return true
}

const onAnchorClick = (e: MouseEvent<HTMLAnchorElement>) => {
  const href = e.currentTarget.getAttribute("href") ?? ""
  if (smoothScrollTo(href)) e.preventDefault()
}

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease, delay },
})

// ---------------------------------------------------------------------------
// Hash-based routing — `#/changelog`, `#/roadmap`, anything else = landing.
// ---------------------------------------------------------------------------

// Watch for scroll past the hero waitlist form. Used to swap which CTA owns
// the shared `waitlist-cta` layoutId — when the hero leaves the viewport the
// header button mounts and framer-motion springs it from the hero position.
const useScrolledPastHero = () => {
  const [pastHero, setPastHero] = useState(false)
  useEffect(() => {
    const onScroll = () => {
      const form = document.getElementById("waitlist")
      if (form === null) return
      const rect = form.getBoundingClientRect()
      // Once the bottom of the form passes above the sticky header.
      setPastHero(rect.bottom < 80)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener("scroll", onScroll)
  }, [])
  return pastHero
}

const useHashRoute = () => {
  const [hash, setHash] = useState(() =>
    typeof window === "undefined" ? "" : window.location.hash
  )
  useEffect(() => {
    const onHash = () => {
      const next = window.location.hash
      setHash(next)
      // Only force scroll-to-top on full-page route hashes (`#/foo`); leave
      // section anchors (`#features`, `#faq`, …) alone so the browser's
      // smooth-scroll lands them at their target.
      if (next.startsWith("#/")) {
        window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior })
      }
    }
    window.addEventListener("hashchange", onHash)
    return () => window.removeEventListener("hashchange", onHash)
  }, [])
  return hash
}

// ---------------------------------------------------------------------------
// Header — sticky, brand left, nav right
// ---------------------------------------------------------------------------

const NAV_LINKS = [
  { label: "Download", href: "#/downloads" },
  { label: "FAQ", href: "#faq" },
  { label: "Blog", href: "#/blog" },
  { label: "Roadmap", href: "#/roadmap" },
  { label: "Changelog", href: "#/changelog" },
]

const ctaTransition = {
  type: "spring" as const,
  stiffness: 380,
  damping: 18,
  mass: 0.9,
}

const Header = ({ pastHero }: { pastHero: boolean }) => {
  const [menuOpen, setMenuOpen] = useState(false)

  // Close the drawer when the route changes (a nav-link click) and lock
  // body scroll while it's open so the page underneath doesn't slide.
  useEffect(() => {
    if (!menuOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [menuOpen])

  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease }}
      className="sticky top-0 z-50 bg-[#120F0C]/70 backdrop-blur"
    >
      <nav className="mx-auto flex h-16 w-[min(1200px,92vw)] items-center justify-between">
        <a href="#/" className="flex items-center gap-2">
          <img src="/logo.png" alt="" className="size-5 shrink-0" />
          <span className="text-sm font-semibold tracking-tight">
            StellarStack
          </span>
        </a>
        <div className="hidden items-center gap-7 text-xs text-zinc-400 md:flex">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={onAnchorClick}
              className="transition-colors hover:text-white"
            >
              {l.label}
            </a>
          ))}
          <a
            href="https://github.com/StellarStackOSS/StellarStack"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="StellarStack on GitHub"
            className="text-zinc-400 transition-colors hover:text-white"
          >
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="size-4"
              aria-hidden
            >
              <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-1.94c-3.2.7-3.87-1.54-3.87-1.54-.52-1.33-1.27-1.69-1.27-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.76 2.69 1.25 3.34.96.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.51-1.47.11-3.06 0 0 .96-.31 3.15 1.18a10.93 10.93 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.59.23 2.77.11 3.06.74.8 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.26 5.68.41.35.78 1.05.78 2.12v3.14c0 .31.21.68.8.56 4.57-1.52 7.86-5.83 7.86-10.91C23.5 5.65 18.35.5 12 .5z" />
            </svg>
          </a>
        </div>
        {/* CTA slot — shared `waitlist-cta` layoutId with the hero
            submit button so the morph from hero → header springs both on
            desktop and mobile. */}
        <div className="ml-auto flex h-9 items-center justify-end md:ml-0 md:min-w-[7.5rem]">
          {pastHero ? (
            <motion.a
              layoutId="waitlist-cta"
              href="#"
              onClick={(e) => {
                e.preventDefault()
                window.scrollTo({ top: 0, behavior: "smooth" })
              }}
              transition={ctaTransition}
              className="rounded-md bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-900 transition-colors hover:bg-zinc-200"
            >
              Get updates
            </motion.a>
          ) : null}
        </div>
        <button
          type="button"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          className="ml-2 inline-flex size-7 items-center justify-center rounded-md border border-white/10 bg-white/5 text-zinc-200 transition-colors hover:bg-white/10 md:hidden"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            className="size-4"
            aria-hidden
          >
            {menuOpen ? (
              <path d="M6 6l12 12M6 18L18 6" />
            ) : (
              <>
                <path d="M4 7h16" />
                <path d="M4 12h16" />
                <path d="M4 17h16" />
              </>
            )}
          </svg>
        </button>
      </nav>

      <AnimatePresence>
        {menuOpen ? (
          <motion.div
            key="mobile-menu"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease }}
            className="absolute inset-x-0 top-16 border-t border-white/5 bg-[#120F0C]/95 backdrop-blur md:hidden"
          >
            <div className="mx-auto flex w-[min(1200px,92vw)] flex-col gap-1 py-4">
              {NAV_LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={(e) => {
                    onAnchorClick(e)
                    setMenuOpen(false)
                  }}
                  className="rounded-md px-3 py-2.5 text-sm text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
                >
                  {l.label}
                </a>
              ))}
              <a
                href="https://github.com/StellarStackOSS/StellarStack"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="size-4"
                  aria-hidden
                >
                  <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-1.94c-3.2.7-3.87-1.54-3.87-1.54-.52-1.33-1.27-1.69-1.27-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.76 2.69 1.25 3.34.96.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.51-1.47.11-3.06 0 0 .96-.31 3.15 1.18a10.93 10.93 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.59.23 2.77.11 3.06.74.8 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.26 5.68.41.35.78 1.05.78 2.12v3.14c0 .31.21.68.8.56 4.57-1.52 7.86-5.83 7.86-10.91C23.5 5.65 18.35.5 12 .5z" />
                </svg>
                GitHub
              </a>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  setMenuOpen(false)
                  window.scrollTo({ top: 0, behavior: "smooth" })
                }}
                className="mt-2 inline-flex h-10 items-center justify-center rounded-md bg-white px-4 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200"
              >
                Get updates
              </a>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.header>
  )
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

const Hero = ({ pastHero }: { pastHero: boolean }) => {
  const [email, setEmail] = useState("")
  const waitlist = useWaitlist()
  const submitting = waitlist.status === "submitting"
  const succeeded = waitlist.status === "ok"

  return (
    <section className="mx-auto flex w-[min(1200px,92vw)] flex-col gap-4 pt-12 md:pt-20">
      <motion.div {...fadeUp(0.1)} className="self-start">
        <a
          href="#/downloads"
          className="inline-flex items-center gap-2 rounded-sm bg-[#282532] px-3 py-1 text-xs font-medium text-[#A397E8] transition-opacity hover:opacity-80"
        >
          <span className="inline-block size-1.5 animate-pulse rounded-full bg-[#A397E8]" />
          Desktop now available
          <span aria-hidden>→</span>
        </a>
      </motion.div>

      <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between md:gap-16">
        <motion.h1
          {...fadeUp(0.2)}
          className="max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl"
        >
          Open-source server hosting,
          <br />
          done correctly.
        </motion.h1>

        <div className="flex max-w-md flex-col gap-4">
          <motion.p
            {...fadeUp(0.3)}
            className="text-sm font-extralight leading-relaxed text-white/70 md:text-base"
          >
            Modern, open-source, AI-assisted — and free to self-host. One
            UI for Minecraft, Rust, Palworld, and anything else Docker can
            run.
            <span className="text-white/90">
              {" "}
              Very early access — expect rough edges.
            </span>
          </motion.p>

          {succeeded ? (
            <motion.div
              {...fadeUp(0.4)}
              role="status"
              className="flex flex-col gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-3 text-sm text-white/80"
            >
              <span>
                Subscribed as{" "}
                <span className="text-white">
                  {waitlist.submittedEmail ?? email}
                </span>
                . We'll email you when there's something worth sharing.
              </span>
              <button
                type="button"
                onClick={waitlist.reset}
                className="self-start text-xs font-medium text-[#A397E8] transition-opacity hover:opacity-80"
              >
                Use a different email →
              </button>
            </motion.div>
          ) : (
            <motion.form
              {...fadeUp(0.4)}
              id="waitlist"
              onSubmit={(e) => {
                e.preventDefault()
                void waitlist.submit(email)
              }}
              className="flex w-full flex-col gap-2"
            >
              <div className="flex w-full items-center gap-2">
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.currentTarget.value)}
                  disabled={submitting}
                  className="h-10 w-full min-w-0 flex-1 rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none disabled:opacity-60"
                />
                {/* Slot reserves layout space; the actual button shares its
                    `waitlist-cta` layoutId with the header so framer-motion
                    can spring the morph between the two. */}
                <div className="relative flex h-10 min-w-[7.75rem] shrink-0 items-center justify-center">
                  {!pastHero ? (
                    <motion.button
                      layoutId="waitlist-cta"
                      type="submit"
                      disabled={submitting}
                      transition={ctaTransition}
                      className="inline-flex h-10 w-full items-center justify-center rounded-md bg-white px-4 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200 disabled:opacity-70"
                    >
                      {submitting ? "Subscribing…" : "Get updates"}
                    </motion.button>
                  ) : null}
                </div>
              </div>

              {/* Honeypot — visually hidden but reachable. Bots auto-fill
                  every input; the API silently accepts and discards. */}
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value={waitlist.honeypot}
                onChange={(e) => waitlist.setHoneypot(e.currentTarget.value)}
                className="absolute -left-[9999px] h-0 w-0 opacity-0"
                aria-hidden
              />

              {waitlist.errorMessage !== null ? (
                <p className="text-xs text-red-300" role="alert">
                  {waitlist.errorMessage}
                </p>
              ) : null}
            </motion.form>
          )}
        </div>
      </div>
    </section>
  )
}

const ProductHuntBadge = () => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.6, ease, delay: 0.55 }}
    className="mx-auto mt-12 flex w-[min(1200px,92vw)] justify-center md:mt-16"
  >
    <a
      href="https://www.producthunt.com/products/stellarstack-2?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-stellarstack-2"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="StellarStack on Product Hunt"
      className="transition-opacity hover:opacity-80"
    >
      <img
        src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1153728&theme=dark&t=1779500809974"
        alt="StellarStack - Open-source server hosting, done correctly | Product Hunt"
        width={250}
        height={54}
        className="h-[54px] w-auto"
      />
    </a>
  </motion.div>
)

const HeroImage = () => (
  <motion.div
    initial={{ opacity: 0, y: 60 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.9, ease, delay: 0.5 }}
    className="mx-auto mt-12 flex w-[min(1200px,92vw)] justify-center md:mt-16"
  >
    <img
      src="/hero.jpeg"
      alt="StellarStack panel preview"
      className="w-full rounded-2xl border border-white/5 shadow-2xl shadow-black/60 ring-1 ring-white/5"
    />
  </motion.div>
)

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export const App = () => {
  const hash = useHashRoute()
  const pastHero = useScrolledPastHero()

  // Resolve full-page hash routes. Returns the React node to render in the
  // main slot, or null to render the landing-page sections.
  const resolveSubpage = (): ReactNode | null => {
    if (hash === "#/changelog") return <Changelog />
    if (hash === "#/downloads") return <Downloads />
    if (hash === "#/install/truenas") return <TrueNAS />
    if (hash === "#/roadmap") return <Roadmap />
    if (hash === "#/privacy") return <Privacy />
    if (hash === "#/terms") return <Terms />
    if (hash === "#/blog" || hash === "#/blog/") return <BlogList />
    if (hash.startsWith("#/blog/")) {
      const slug = hash.slice("#/blog/".length).replace(/\/$/, "")
      return <BlogPostView slug={slug} />
    }
    return null
  }
  const subpage = resolveSubpage()

  return (
    <div className="dark min-h-screen bg-[#120F0C] text-white">
      <Header pastHero={subpage !== null || pastHero} />
      {subpage !== null ? (
        subpage
      ) : (
        <>
          <Hero pastHero={pastHero} />
          <ProductHuntBadge />
          <HeroImage />
          <StackStrip />
          <HowItWorks />
          <Features />
          <Faq />
        </>
      )}
      <SiteFooter />
    </div>
  )
}

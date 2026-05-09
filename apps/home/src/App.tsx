import { motion } from "framer-motion"
import type { MouseEvent } from "react"
import { useEffect, useState } from "react"

import { useWaitlist } from "@/hooks/useWaitlist"

import { Changelog } from "@/components/Changelog"
import { Faq } from "@/components/Faq"
import { Features } from "@/components/Features"
import { HowItWorks } from "@/components/HowItWorks"
import { Privacy, Terms } from "@/components/Legal"
import { Pricing } from "@/components/Pricing"
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
  { label: "How it works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
  { label: "Roadmap", href: "#/roadmap" },
  { label: "Changelog", href: "#/changelog" },
]

const ctaTransition = {
  type: "spring" as const,
  stiffness: 380,
  damping: 18,
  mass: 0.9,
}

const Header = ({ pastHero }: { pastHero: boolean }) => (
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
      </div>
      <div className="flex h-9 min-w-[7.5rem] items-center justify-end">
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
            Join waitlist
          </motion.a>
        ) : null}
      </div>
    </nav>
  </motion.header>
)

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
          href="#waitlist"
          onClick={onAnchorClick}
          className="inline-flex items-center gap-2 rounded-sm bg-[#282532] px-3 py-1 text-xs font-medium text-[#A397E8] transition-opacity hover:opacity-80"
        >
          Coming Q3 2026
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
            Modern, open-source, AI-assisted. One UI for Minecraft, Rust,
            Palworld, and anything else Docker can run.
          </motion.p>

          {succeeded ? (
            <motion.div
              {...fadeUp(0.4)}
              role="status"
              className="rounded-md border border-white/10 bg-white/5 px-3 py-3 text-sm text-white/80"
            >
              Check your inbox — we sent a confirmation link to{" "}
              <span className="text-white">{email}</span>.
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
                      {submitting ? "Joining…" : "Join waitlist"}
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

              {/* Cloudflare Turnstile invisible widget anchor. */}
              <div
                ref={waitlist.turnstileContainerRef}
                className="absolute h-0 w-0 overflow-hidden"
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

const HeroImage = () => (
  <motion.div
    initial={{ opacity: 0, y: 60 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.9, ease, delay: 0.5 }}
    className="mx-auto mt-16 flex w-[min(1200px,92vw)] justify-center md:mt-20"
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
  const subpage =
    hash === "#/changelog"
      ? "changelog"
      : hash === "#/roadmap"
        ? "roadmap"
        : hash === "#/privacy"
          ? "privacy"
          : hash === "#/terms"
            ? "terms"
            : null

  return (
    <div className="dark min-h-screen bg-[#120F0C] text-white">
      <Header pastHero={subpage !== null || pastHero} />
      {subpage !== null ? (
        subpage === "changelog" ? (
          <Changelog />
        ) : subpage === "roadmap" ? (
          <Roadmap />
        ) : subpage === "privacy" ? (
          <Privacy />
        ) : (
          <Terms />
        )
      ) : (
        <>
          <Hero pastHero={pastHero} />
          <HeroImage />
          <StackStrip />
          <HowItWorks />
          <Features />
          <Pricing />
          <Faq />
        </>
      )}
      <SiteFooter />
    </div>
  )
}

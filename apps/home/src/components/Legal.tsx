import type { ReactNode } from "react"

import { Reveal } from "@/components/Reveal"

// ---------------------------------------------------------------------------
// Shared layout for legal/static text pages.
// ---------------------------------------------------------------------------

const LegalShell = ({
  eyebrow,
  title,
  lastUpdated,
  children,
}: {
  eyebrow: string
  title: string
  lastUpdated: string
  children: ReactNode
}) => (
  <main className="mx-auto w-[min(800px,92vw)] py-12 md:py-20">
    <Reveal>
      <header className="flex flex-col gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#A397E8]">
          {eyebrow}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          {title}
        </h1>
        <p className="text-xs text-zinc-500">Last updated {lastUpdated}</p>
      </header>
    </Reveal>

    <Reveal delay={0.05}>
      <div className="prose-zinc mt-12 flex flex-col gap-10 text-sm font-extralight leading-relaxed text-zinc-300">
        {children}
      </div>
    </Reveal>
  </main>
)

const Section = ({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) => (
  <section className="flex flex-col gap-3">
    <h2 className="text-base font-medium text-white">{title}</h2>
    <div className="flex flex-col gap-3 text-zinc-400">{children}</div>
  </section>
)

// ---------------------------------------------------------------------------
// Privacy — covers only the marketing site (stellarstack.app). The
// open-source panel + daemon are self-hosted by you and never call home.
// ---------------------------------------------------------------------------

export const Privacy = () => (
  <LegalShell eyebrow="Legal" title="Privacy Policy" lastUpdated="May 2026">
    <Section title="Who we are">
      <p>
        StellarStack is an open-source game-server control panel. This
        policy covers the marketing site at stellarstack.app — what we
        collect when you visit it and subscribe to release updates.
      </p>
      <p>
        The panel + daemon software you download and self-host is governed
        by the MIT license and doesn't send anything back to us — no
        telemetry, no phone-home, no analytics. Once it's on your boxes,
        we have no visibility into it.
      </p>
    </Section>

    <Section title="What the marketing site collects">
      <ul className="ml-5 list-disc space-y-2">
        <li>
          Your email address, if you subscribe to release updates via the
          form on the homepage. That's the only field we ask for.
        </li>
        <li>
          A hashed form of the IP address you submitted from, used purely
          for rate-limiting + abuse detection on the signup endpoint. The
          raw IP isn't stored.
        </li>
      </ul>
    </Section>

    <Section title="How we use it">
      <p>
        Email addresses are used to send occasional release announcements
        — when something interesting ships. We don't sell, share, or
        rent them.
      </p>
      <p>
        You can unsubscribe any time by clicking the link in any email we
        send, or by emailing{" "}
        <a
          href="mailto:privacy@stellarstack.app"
          className="text-white underline"
        >
          privacy@stellarstack.app
        </a>
        .
      </p>
    </Section>

    <Section title="Where data lives">
      <p>
        Email addresses live in a Postgres instance in the EU. Transactional
        email is sent via Resend.
      </p>
    </Section>

    <Section title="Your rights">
      <p>
        You can request a copy of everything we hold on you, or ask for
        deletion, at any time. Email{" "}
        <a
          href="mailto:privacy@stellarstack.app"
          className="text-white underline"
        >
          privacy@stellarstack.app
        </a>{" "}
        and we'll respond within five business days.
      </p>
    </Section>

    <Section title="Contact">
      <p>
        Questions? Email{" "}
        <a
          href="mailto:privacy@stellarstack.app"
          className="text-white underline"
        >
          privacy@stellarstack.app
        </a>
        .
      </p>
    </Section>
  </LegalShell>
)

// ---------------------------------------------------------------------------
// Terms — also marketing-site only. The MIT license covers your use of
// the software; this page covers the website itself.
// ---------------------------------------------------------------------------

export const Terms = () => (
  <LegalShell eyebrow="Legal" title="Terms of Use" lastUpdated="May 2026">
    <Section title="The software">
      <p>
        The StellarStack panel + daemon are released under the MIT license.
        That license is the agreement; these terms don't add anything on
        top of it for the software itself.
      </p>
    </Section>

    <Section title="This website">
      <p>
        By using stellarstack.app you agree not to use it to:
      </p>
      <ul className="ml-5 list-disc space-y-2">
        <li>Submit junk or someone else's email to the signup form.</li>
        <li>
          Scrape the site at a rate that interferes with normal use, or
          probe its infrastructure for vulnerabilities outside a good-faith
          security report.
        </li>
        <li>
          Misrepresent your identity to obtain or attempt to obtain access
          to anything that isn't public.
        </li>
      </ul>
    </Section>

    <Section title="No warranty">
      <p>
        StellarStack is provided "as is" — both the website and the
        open-source software. We're a small team building a useful tool;
        if something breaks, file an issue, but we can't be held liable
        for lost game worlds, missed events, or anything else downstream.
        Back up your data.
      </p>
    </Section>

    <Section title="Changes">
      <p>
        We may update these terms occasionally. The "Last updated" date
        above moves whenever we do. Material changes will be announced via
        the changelog.
      </p>
    </Section>

    <Section title="Contact">
      <p>
        Questions? Email{" "}
        <a
          href="mailto:legal@stellarstack.app"
          className="text-white underline"
        >
          legal@stellarstack.app
        </a>
        .
      </p>
    </Section>
  </LegalShell>
)

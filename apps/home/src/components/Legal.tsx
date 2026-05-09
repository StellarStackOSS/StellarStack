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
// Privacy policy
// ---------------------------------------------------------------------------

export const Privacy = () => (
  <LegalShell
    eyebrow="Legal"
    title="Privacy Policy"
    lastUpdated="May 2026"
  >
    <Section title="Who we are">
      <p>
        StellarStack Inc. ("we", "us") operates the StellarStack open-source
        game-server panel and the hosted version available at
        stellarstack.dev. This policy covers what we collect when you use
        either, why we collect it, and what we do with it.
      </p>
    </Section>

    <Section title="What we collect">
      <p>
        For the open-source self-hosted version we collect nothing — the
        panel and daemon run on your machines and never call home.
      </p>
      <p>For the hosted version we collect:</p>
      <ul className="ml-5 list-disc space-y-2">
        <li>Your account email and display name.</li>
        <li>The IP address of the request when you sign in.</li>
        <li>
          Server metadata — names, blueprint IDs, allocations, resource
          usage. We don't read your game world data, your file manager
          contents, or your console output unless you explicitly send a
          crash report or use the Ask AI feature.
        </li>
        <li>
          Stripe payment metadata (last four digits, country) — full card
          details never touch our servers.
        </li>
      </ul>
    </Section>

    <Section title="How we use it">
      <ul className="ml-5 list-disc space-y-2">
        <li>To run your account and authenticate sessions.</li>
        <li>To bill paid plans through Stripe.</li>
        <li>
          To send transactional email (sign-up, password reset, billing
          receipts). We don't send marketing emails.
        </li>
        <li>To investigate abuse and respond to support requests.</li>
      </ul>
    </Section>

    <Section title="AI features">
      <p>
        When you click "Ask AI" the relevant console lines and your
        question are sent to Anthropic's Claude API. Anthropic doesn't use
        the data to train their models. We don't store the prompt or the
        response beyond your active session.
      </p>
    </Section>

    <Section title="Where data lives">
      <p>
        Hosted-version data lives in EU-based Postgres (managed by Railway)
        and S3-compatible storage (managed by Backblaze B2). Backups are
        encrypted at rest.
      </p>
    </Section>

    <Section title="Your rights">
      <p>
        You can export your data, delete your account, and request a copy
        of everything we hold on you at any time. Email{" "}
        <a
          href="mailto:privacy@stellarstack.dev"
          className="text-white underline"
        >
          privacy@stellarstack.dev
        </a>{" "}
        and we'll respond within five business days.
      </p>
    </Section>

    <Section title="Contact">
      <p>
        Questions? Email{" "}
        <a
          href="mailto:privacy@stellarstack.dev"
          className="text-white underline"
        >
          privacy@stellarstack.dev
        </a>
        .
      </p>
    </Section>
  </LegalShell>
)

// ---------------------------------------------------------------------------
// Terms of service
// ---------------------------------------------------------------------------

export const Terms = () => (
  <LegalShell
    eyebrow="Legal"
    title="Terms of Service"
    lastUpdated="May 2026"
  >
    <Section title="Acceptance">
      <p>
        By creating a StellarStack account or running the hosted version
        you agree to these terms. If you don't agree, don't use the
        service. The open-source self-hosted version is governed by the
        MIT license, not these terms.
      </p>
    </Section>

    <Section title="Acceptable use">
      <p>You agree not to use StellarStack to:</p>
      <ul className="ml-5 list-disc space-y-2">
        <li>Host content that violates the law in your jurisdiction.</li>
        <li>Send spam, run cryptocurrency miners, or perform DDoS attacks.</li>
        <li>
          Reverse-engineer the hosted infrastructure or attempt to access
          other tenants' data.
        </li>
        <li>
          Resell the hosted product as a white-label service without a
          partnership agreement.
        </li>
      </ul>
      <p>
        We reserve the right to suspend accounts that violate these rules.
        We'll always tell you why and give you a chance to export your data.
      </p>
    </Section>

    <Section title="Plans and billing">
      <p>
        Paid plans are billed monthly or annually through Stripe. You can
        cancel any time — your plan stays active until the end of the
        current billing period. We don't offer refunds for partial periods
        but we do offer pro-rated credits when we screw something up.
      </p>
    </Section>

    <Section title="Service availability">
      <p>
        We aim for 99.9% uptime on the hosted panel. The hosted panel is
        the part we control — your game servers run on hardware you bring,
        and that's outside our SLA. If we miss our uptime target we'll
        credit your next invoice without you having to ask.
      </p>
    </Section>

    <Section title="Liability">
      <p>
        StellarStack is provided "as is". We're a small team building a
        useful tool — we're not liable for lost game saves, missed
        tournaments, or content posted on servers you host. Back up your
        worlds; we'll do our part on the panel side.
      </p>
    </Section>

    <Section title="Changes">
      <p>
        We may update these terms occasionally. Material changes will be
        announced via email and on the changelog page at least 30 days
        before they take effect.
      </p>
    </Section>

    <Section title="Contact">
      <p>
        Questions? Email{" "}
        <a
          href="mailto:legal@stellarstack.dev"
          className="text-white underline"
        >
          legal@stellarstack.dev
        </a>
        .
      </p>
    </Section>
  </LegalShell>
)

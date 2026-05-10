import NumberFlow from "@number-flow/react"
import { motion } from "framer-motion"
import { useState } from "react"

import { Reveal, RevealItem, RevealStagger } from "@/components/Reveal"

type Billing = "monthly" | "annual"

type Plan = {
  name: string
  /** Monthly list price; null = free. Annual is computed at 15% off. */
  monthlyPrice: number | null
  /** Free-text prefix on the price (e.g. "From "). */
  pricePrefix?: string
  unit?: string
  description: string
  cta: { label: string; href: string }
  features: string[]
  highlight?: boolean
  /** Plans we haven't opened yet — rendered greyed-out with a "Coming
   *  later" badge so the roadmap is visible without overpromising. */
  comingLater?: boolean
}

const PLANS: Plan[] = [
  {
    name: "Self-host",
    monthlyPrice: null,
    description:
      "MIT-licensed panel + daemon. Run on your own boxes, your own network, your own rules. This is what we're building right now.",
    cta: { label: "Join the waitlist", href: "#waitlist" },
    features: [
      "Unlimited nodes & servers",
      "Every blueprint, every feature",
      "Browser-direct daemon WS",
      "SFTP, backups, schedules, audit log",
      "Community support",
    ],
    highlight: true,
  },
  {
    name: "Cloud",
    monthlyPrice: 12,
    unit: "/ node / month",
    description:
      "We host the panel, the database, and the auth layer. You bring the nodes — any VPS or dedicated box that runs Docker.",
    cta: { label: "Join the waitlist", href: "#waitlist" },
    features: [
      "Managed panel on stellarstack.dev",
      "Managed Postgres + S3 backups",
      "Custom subdomain on your panel",
      "Bring your own nodes (any provider)",
      "Email support, < 24h response",
    ],
    comingLater: true,
  },
  {
    name: "Cloud + Hardware",
    monthlyPrice: 19,
    unit: "/ server / month",
    description:
      "Fully managed. We run the panel and the nodes — you just create servers and invite friends.",
    cta: { label: "Join the waitlist", href: "#waitlist" },
    features: [
      "Everything in Cloud",
      "Managed bare-metal in EU & US",
      "DDoS protection on game traffic",
      "Hourly world snapshots included",
      "Priority support",
    ],
    comingLater: true,
  },
]

const ANNUAL_DISCOUNT = 0.15

// 15% off the monthly rate; annual plans are still billed monthly so the
// per-month number is what we surface.
const effectivePrice = (plan: Plan, billing: Billing) => {
  if (plan.monthlyPrice === null) return 0
  return billing === "annual"
    ? Math.round(plan.monthlyPrice * (1 - ANNUAL_DISCOUNT))
    : plan.monthlyPrice
}

const CheckIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.5}
    className="mt-0.5 size-3.5 shrink-0 text-[#A397E8]"
  >
    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const BillingToggle = ({
  billing,
  onChange,
}: {
  billing: Billing
  onChange: (next: Billing) => void
}) => (
  <div className="inline-flex items-center gap-3">
    <div className="relative inline-flex items-center rounded-full border border-white/8 bg-[#201c19] p-1 text-xs">
      {(["monthly", "annual"] as const).map((option) => {
        const active = billing === option
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`relative z-10 rounded-full px-4 py-1.5 font-medium capitalize transition-colors ${
              active ? "text-zinc-900" : "text-zinc-400 hover:text-white"
            }`}
          >
            {active ? (
              <motion.span
                layoutId="billing-pill"
                className="absolute inset-0 -z-10 rounded-full bg-white"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            ) : null}
            {option}
          </button>
        )
      })}
    </div>
    <span className="rounded-sm bg-[#282532] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#A397E8]">
      Save 15%
    </span>
  </div>
)

const PriceBlock = ({
  plan,
  billing,
}: {
  plan: Plan
  billing: Billing
}) => {
  if (plan.monthlyPrice === null) {
    return (
      <span className="text-5xl font-semibold tracking-tight">Free</span>
    )
  }
  return (
    <div className="flex items-baseline gap-1.5">
      {plan.pricePrefix !== undefined ? (
        <span className="text-2xl font-semibold tracking-tight text-zinc-400">
          {plan.pricePrefix}
        </span>
      ) : null}
      <span className="inline-flex items-baseline text-5xl font-semibold tracking-tight">
        <span>$</span>
        <NumberFlow
          value={effectivePrice(plan, billing)}
          transformTiming={{ duration: 500, easing: "ease-out" }}
        />
      </span>
      {plan.unit !== undefined ? (
        <span className="text-xs font-extralight text-zinc-500">
          {plan.unit}
        </span>
      ) : null}
    </div>
  )
}

const PlanCard = ({
  plan,
  billing,
}: {
  plan: Plan
  billing: Billing
}) => {
  const dimmed = plan.comingLater === true
  return (
    <div
      className={`flex h-full flex-col gap-6 rounded-2xl border bg-[#201c19] p-7 transition-colors ${
        dimmed
          ? "border-white/5 opacity-70 hover:border-white/10"
          : "border-white/8 hover:border-white/15"
      }`}
    >
      <header className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xl font-semibold tracking-tight text-white">
            {plan.name}
          </h3>
          {plan.comingLater === true ? (
            <span className="rounded-sm bg-[#282532] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#A397E8]">
              Coming later
            </span>
          ) : plan.highlight === true ? (
            <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#A397E8]">
              Available now
            </span>
          ) : null}
        </div>
        <div className="flex h-14 items-baseline">
          <PriceBlock plan={plan} billing={billing} />
        </div>
        <p className="h-[5.25rem] overflow-hidden text-sm font-extralight leading-relaxed text-zinc-400">
          {plan.description}
        </p>
      </header>

      <div className="border-t border-white/5" />

      <ul className="flex flex-col gap-2.5">
        {plan.features.map((f) => (
          <li
            key={f}
            className="flex items-start gap-2.5 text-sm font-extralight text-zinc-300"
          >
            <CheckIcon />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <a
        href={plan.cta.href}
        className="mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-white transition-colors hover:text-[#A397E8]"
      >
        {dimmed ? "Notify me" : plan.cta.label}
        <span aria-hidden>→</span>
      </a>
    </div>
  )
}

export const Pricing = () => {
  const [billing, setBilling] = useState<Billing>("monthly")

  return (
    <section
      id="pricing"
      className="mx-auto flex w-[min(1200px,92vw)] flex-col gap-14 py-32"
    >
      <Reveal>
        <header className="flex flex-col gap-6">
          <div className="flex max-w-2xl flex-col gap-3">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#A397E8]">
              Pricing
            </p>
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Open-source first. Hosted later.
            </h2>
            <p className="text-sm font-extralight text-zinc-400">
              Right now we're focused on shipping a great self-host
              experience — the panel and daemon are MIT, full-stop. The Cloud
              plans below are the roadmap, not the pitch; we'll open them
              when the self-host story is rock-solid.
            </p>
          </div>
          <BillingToggle billing={billing} onChange={setBilling} />
        </header>
      </Reveal>

      <div className="flex flex-col gap-4">
        <RevealStagger className="grid gap-4 md:grid-cols-3">
          {PLANS.map((plan) => (
            <RevealItem key={plan.name}>
              <PlanCard plan={plan} billing={billing} />
            </RevealItem>
          ))}
        </RevealStagger>

        <Infrastructure />
      </div>
    </section>
  )
}

const Infrastructure = () => (
  <Reveal delay={0.05}>
    <p className="max-w-3xl text-xs font-extralight leading-relaxed text-zinc-500">
      When Cloud + Hardware launches, it will run out of London (UK),
      Frankfurt (Germany), Amsterdam (Netherlands), Miami (Florida) and
      Beauharnois (Canada). Hardware will range from AMD EPYC 4245P to
      Ryzen 7950X depending on location, with 128 GB DDR5, NVMe SSD storage,
      10 Gbit uplink and L3–L7 DDoS protection as standard.
    </p>
  </Reveal>
)

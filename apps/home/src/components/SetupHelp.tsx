import { Reveal } from "@/components/Reveal"

const SUBJECT = "StellarStack setup help"
const BODY = `Hey Marques,

I'd like help setting up StellarStack. A bit about my setup:

- I have / want N servers, mostly running …
- I already have a box at … (or: I don't have a box yet)
- My rough budget is …
- I'd like it deployed at the domain …

What's the next step?
`

const MAILTO = `mailto:marques@stellarstack.app?subject=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(BODY)}`

export const SetupHelp = () => (
  <section
    id="setup-help"
    className="mx-auto flex w-[min(1200px,92vw)] flex-col gap-10 py-32"
  >
    <Reveal>
      <header className="flex max-w-2xl flex-col gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#A397E8]">
          Setup help
        </p>
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Don't want to deploy it yourself?
        </h2>
        <p className="text-sm font-extralight leading-relaxed text-zinc-400">
          If you'd rather skip the install, the daemon pairing and the
          Postgres setup, I'll do it for you. Drop me a line and we'll
          work out what your boxes need and stand it up together.
        </p>
      </header>
    </Reveal>

    <Reveal delay={0.05}>
      <div className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-[#201c19] p-6 md:flex-row md:items-center md:justify-between md:p-8">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-white">
            Reach out directly
          </span>
          <span className="font-mono text-xs text-zinc-500">
            marques@stellarstack.app
          </span>
        </div>
        <a
          href={MAILTO}
          className="inline-flex h-10 items-center justify-center gap-1.5 self-start rounded-md bg-white px-4 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200 md:self-auto"
        >
          Email me
          <span aria-hidden>→</span>
        </a>
      </div>
    </Reveal>
  </section>
)

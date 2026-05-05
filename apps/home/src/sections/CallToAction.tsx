import { Reveal } from "@/components/Reveal"

export const CallToAction = () => {
  return (
    <section className="py-32">
      <Reveal>
        <div className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl border border-white/8 bg-[#0c0c0c] px-8 py-20 text-center">
          <div
            aria-hidden
            className="absolute inset-0 opacity-50"
            style={{
              backgroundImage: "url(/example.jpeg)",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/70 to-black"
          />
          <div className="relative flex flex-col items-center gap-5">
            <h2 className="text-balance text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Get started with StellarStack
            </h2>
            <p className="max-w-xl text-sm text-zinc-400">
              Self-host today. Five commands and you're running — no Java, no
              PHP, no licence keys.
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
              <a
                href="/register"
                className="rounded-full bg-white px-5 py-2 text-sm font-medium text-black transition-all hover:scale-[1.02] hover:bg-zinc-100"
              >
                Sign up
              </a>
              <a
                href="https://github.com/StellarStackOSS"
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-white/15 bg-white/5 px-5 py-2 text-sm font-medium text-zinc-200 transition-all hover:border-white/30 hover:bg-white/10"
              >
                View on GitHub
              </a>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  )
}

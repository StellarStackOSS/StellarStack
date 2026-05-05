import { motion } from "framer-motion"

export const Hero = () => {
  return (
    <section className="relative -mx-4 overflow-hidden md:-mx-6">
      {/* Full-width hero background image. Drop the actual product
          screenshot in here at /example.jpeg — the gradient overlays
          beneath the headline keep text readable while the image
          carries the visual weight. */}
      <div className="relative">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage: "url(/example.jpeg)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        {/* Top-down readability gradient + bottom fade-to-page so the
            image dissolves into the next section. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black"
        />
        {/* Subtle vignette to focus on the centre. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.55)_100%)]"
        />

        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: {
              transition: { staggerChildren: 0.08, delayChildren: 0.05 },
            },
          }}
          className="relative mx-auto flex min-h-[640px] max-w-3xl flex-col items-center justify-center gap-6 px-6 py-32 text-center md:min-h-[720px] md:py-40"
        >
          <motion.span
            variants={{
              hidden: { opacity: 0, y: 8 },
              visible: {
                opacity: 1,
                y: 0,
                transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
              },
            }}
            className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-200 backdrop-blur"
          >
            Version 1.0
          </motion.span>
          <motion.h1
            variants={{
              hidden: { opacity: 0, y: 14 },
              visible: {
                opacity: 1,
                y: 0,
                transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
              },
            }}
            className="text-balance text-5xl font-semibold leading-[1.05] tracking-tight text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.6)] md:text-6xl"
          >
            Stop chasing servers.
            <br />
            <span className="text-white/70">Start running them.</span>
          </motion.h1>
          <motion.p
            variants={{
              hidden: { opacity: 0, y: 12 },
              visible: {
                opacity: 1,
                y: 0,
                transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
              },
            }}
            className="max-w-xl text-balance text-base text-zinc-300 drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)] md:text-[17px]"
          >
            StellarStack is a self-hosted game-server panel — multi-node,
            blueprint-driven, with a browser-direct daemon socket. Power,
            console, files and stats in one place that's actually nice to
            live in.
          </motion.p>
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 8 },
              visible: {
                opacity: 1,
                y: 0,
                transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
              },
            }}
            className="mt-2 flex flex-wrap items-center justify-center gap-3"
          >
            <a
              href="https://github.com/StellarStackOSS"
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-white/20 bg-white/10 px-5 py-2 text-sm font-medium text-white backdrop-blur transition-all hover:border-white/40 hover:bg-white/15"
            >
              Learn more
            </a>
            <a
              href="/register"
              className="group relative inline-flex items-center justify-center rounded-full bg-white px-5 py-2 text-sm font-medium text-black transition-all hover:scale-[1.02] hover:bg-zinc-100"
            >
              Get started
              <span className="ml-1.5 transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </a>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

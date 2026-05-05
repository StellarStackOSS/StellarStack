import { motion } from "framer-motion"

type Logo = { name: string; slug: string }

// Slugs map to https://cdn.simpleicons.org/<slug>/<colour>. We render
// every logo in white so they sit consistently on the dark page.
const items: Logo[] = [
  { name: "Go", slug: "go" },
  { name: "React", slug: "react" },
  { name: "TypeScript", slug: "typescript" },
  { name: "Hono", slug: "hono" },
  { name: "Postgres", slug: "postgresql" },
  { name: "Redis", slug: "redis" },
  { name: "Docker", slug: "docker" },
  { name: "Tailwind", slug: "tailwindcss" },
  { name: "Drizzle", slug: "drizzle" },
  { name: "Vite", slug: "vite" },
  { name: "pnpm", slug: "pnpm" },
  { name: "Turborepo", slug: "turborepo" },
]

const Track = ({ ariaHidden = false }: { ariaHidden?: boolean }) => (
  <div
    className="flex shrink-0 items-center gap-12 pr-12"
    aria-hidden={ariaHidden ? "true" : undefined}
  >
    {items.map((it) => (
      <div
        key={it.name}
        className="flex shrink-0 items-center gap-2.5 opacity-60 transition-opacity hover:opacity-100"
      >
        <img
          src={`https://cdn.simpleicons.org/${it.slug}/ffffff`}
          alt={it.name}
          className="size-5 shrink-0"
          loading="lazy"
        />
        <span className="text-sm font-medium text-zinc-300">{it.name}</span>
      </div>
    ))}
  </div>
)

export const StackStrip = () => {
  return (
    <section className="border-y border-white/5 py-10">
      <div className="mx-auto max-w-6xl px-6">
        <motion.span
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6 }}
          className="mb-6 block text-center text-[11px] font-medium uppercase tracking-[0.3em] text-zinc-600"
        >
          Built with
        </motion.span>
        {/* Edge-to-edge marquee with a soft fade-out mask on each side
            so the logos appear to scroll out of view rather than
            abruptly cutting off. Track is duplicated and animated at a
            steady pace; the second copy starts where the first ends so
            the loop is seamless. */}
        <div
          className="relative overflow-hidden"
          style={{
            maskImage:
              "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
            WebkitMaskImage:
              "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
          }}
        >
          <motion.div
            className="flex w-max"
            animate={{ x: ["0%", "-50%"] }}
            transition={{
              duration: 35,
              ease: "linear",
              repeat: Infinity,
            }}
          >
            <Track />
            <Track ariaHidden />
          </motion.div>
        </div>
      </div>
    </section>
  )
}

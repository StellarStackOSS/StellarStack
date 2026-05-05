import { motion } from "framer-motion"

const links = [
  { label: "Home", href: "#" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "FAQ", href: "#faq" },
]

export const SiteNav = () => {
  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="sticky top-0 z-50 border-b border-white/5 bg-black/60 backdrop-blur"
    >
      <nav className="mx-auto grid h-16 w-full max-w-7xl grid-cols-3 items-center px-6">
        <a href="#" className="flex items-center gap-2 justify-self-start">
          <img
            src="/icon.png"
            alt=""
            className="size-7 shrink-0 rounded-md"
          />
          <span className="text-sm font-semibold tracking-tight text-white">
            StellarStack
          </span>
        </a>
        <div className="hidden items-center justify-center gap-8 text-xs text-zinc-400 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="transition-colors hover:text-white"
            >
              {l.label}
            </a>
          ))}
        </div>
        <div className="flex items-center justify-end gap-3">
          <a
            href="/login"
            className="text-xs text-zinc-300 transition-colors hover:text-white"
          >
            Login
          </a>
          <a
            href="/register"
            className="rounded-full bg-white px-3.5 py-1.5 text-xs font-medium text-black transition-colors hover:bg-zinc-200"
          >
            Sign up
          </a>
        </div>
      </nav>
    </motion.header>
  )
}

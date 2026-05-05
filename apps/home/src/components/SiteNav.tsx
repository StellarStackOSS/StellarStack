import { Button } from "@workspace/ui/components/button"

const links = [
  { label: "Features", href: "#features" },
  { label: "Showcase", href: "#showcase" },
  { label: "Architecture", href: "#architecture" },
  { label: "Stack", href: "#stack" },
]

export const SiteNav = () => {
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-background/80 backdrop-blur">
      <nav className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-6">
        <a href="#" className="flex items-center gap-2">
          <span className="bg-sidebar-accent text-sidebar-accent-foreground flex aspect-square size-7 items-center justify-center rounded-md text-[11px] font-bold">
            S
          </span>
          <span className="text-sm font-semibold tracking-tight">StellarStack</span>
        </a>
        <div className="hidden flex-1 items-center gap-5 text-xs text-zinc-400 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="transition-colors hover:text-zinc-100"
            >
              {l.label}
            </a>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <a
            href="https://github.com/StellarStackOSS"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-zinc-400 transition-colors hover:text-zinc-100"
          >
            GitHub
          </a>
          <a href="/login">
            <Button size="sm" variant="outline">
              Sign in
            </Button>
          </a>
          <a href="/register">
            <Button size="sm">Get started</Button>
          </a>
        </div>
      </nav>
    </header>
  )
}

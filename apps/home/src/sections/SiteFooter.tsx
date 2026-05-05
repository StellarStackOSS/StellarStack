export const SiteFooter = () => {
  return (
    <footer className="mt-16 border-t border-white/5">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-xs text-zinc-500 md:flex-row">
        <span>© {new Date().getFullYear()} StellarStack</span>
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/StellarStackOSS"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-zinc-200"
          >
            GitHub
          </a>
          <a
            href="https://github.com/StellarStackOSS/StellarStack-Planets"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-zinc-200"
          >
            Planets
          </a>
          <a href="/login" className="transition-colors hover:text-zinc-200">
            Sign in
          </a>
        </div>
      </div>
    </footer>
  )
}

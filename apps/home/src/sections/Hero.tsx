import { Button } from "@workspace/ui/components/button"
import { TextureBadge } from "@workspace/ui/components/texture-badge"

import { ServerStatusBadgeDemo } from "@/components/ServerStatusBadgeDemo"

export const Hero = () => {
  return (
    <section className="relative flex flex-col items-center gap-6 pt-12 text-center">
      <TextureBadge variant="secondary" size="sm">
        Open source · multi-node · standard-shape
      </TextureBadge>
      <h1 className="max-w-3xl text-5xl font-semibold tracking-tight md:text-6xl">
        The game-server panel that's actually nice to live in.
      </h1>
      <p className="max-w-2xl text-base text-zinc-400 md:text-lg">
        StellarStack is a self-hosted control panel for Minecraft, Source-engine,
        Rust, and anything else you can put in a container. Browser-direct
        daemon WebSocket, blueprint-driven readiness, server splitting, and a
        UI that doesn't bury features under five clicks.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <a href="https://github.com/StellarStackOSS" target="_blank" rel="noreferrer">
          <Button size="lg">View on GitHub</Button>
        </a>
        <a href="/register">
          <Button size="lg" variant="outline">
            Get started
          </Button>
        </a>
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs text-zinc-500">
        <span>States transition like:</span>
        <ServerStatusBadgeDemo />
      </div>
    </section>
  )
}

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardInner,
  CardTitle,
} from "@workspace/ui/components/card"

export const CallToAction = () => {
  return (
    <section className="flex flex-col gap-8">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Self-host it today</CardTitle>
        </CardHeader>
        <CardContent>
          <CardInner className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-base font-semibold text-zinc-100">
                pnpm dev — five commands and you're running.
              </span>
              <span className="text-xs text-zinc-400">
                Postgres + Redis via docker compose, daemon written in Go,
                panel + API hot-reload via Vite. No Java, no PHP, no licence.
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <a
                href="https://github.com/StellarStackOSS"
                target="_blank"
                rel="noreferrer"
              >
                <Button size="lg">View on GitHub</Button>
              </a>
              <a href="/register">
                <Button size="lg" variant="outline">
                  Try the panel
                </Button>
              </a>
            </div>
          </CardInner>
        </CardContent>
      </Card>
    </section>
  )
}

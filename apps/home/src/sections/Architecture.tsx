import {
  Card,
  CardContent,
  CardHeader,
  CardInner,
  CardTitle,
} from "@workspace/ui/components/card"

export const Architecture = () => {
  return (
    <section id="architecture" className="flex flex-col gap-8">
      <header className="flex flex-col gap-2 text-center">
        <span className="text-xs font-medium uppercase tracking-[0.3em] text-zinc-500">
          The shape
        </span>
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Browser ↔ daemon, the API stays out of the way
        </h2>
        <p className="mx-auto max-w-2xl text-sm text-zinc-400">
          Power, console, stats and command flow over a single per-server
          WebSocket the browser opens directly against the daemon. The API
          handles auth, mints a per-node JWT, and persists the state
          transitions the daemon pushes back via HMAC-signed callbacks.
        </p>
      </header>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>System overview</CardTitle>
        </CardHeader>
        <CardContent>
          <CardInner className="overflow-x-auto p-4">
            <pre className="font-mono text-[12px] leading-relaxed text-zinc-300">
{`Browser ──(REST: auth, server CRUD, /servers/:id/credentials)──> API (Hono)
   │                                                                │
   │                                                                ├──> Postgres
   │                                                                ├──> Redis (status cache)
   │                                                                └──(HTTP: install, files, backup ops)──> Daemon
   │
   └──(WS: power + state + console + stats, single socket per server)──> Daemon (Go)
                                                                        │
                                                                        └──(HTTP push: status + audit)──> API`}
            </pre>
          </CardInner>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Daemon (Go)</CardTitle>
          </CardHeader>
          <CardContent>
            <CardInner className="p-3">
              <p className="text-xs leading-relaxed text-zinc-400">
                One per-server WebSocket multiplexes power, console output,
                stats, and commands. Owns the synchronous power chain
                (start / stop / restart / kill) and signals state changes to
                the API via signed HTTP callbacks.
              </p>
            </CardInner>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>API (Hono)</CardTitle>
          </CardHeader>
          <CardContent>
            <CardInner className="p-3">
              <p className="text-xs leading-relaxed text-zinc-400">
                Auth + JWT mint + thin server CRUD. Mints a short-lived
                per-node JWT scoped to a single server when the browser
                wants to talk to the daemon. Drives the install runner.
              </p>
            </CardInner>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Panel (React)</CardTitle>
          </CardHeader>
          <CardContent>
            <CardInner className="p-3">
              <p className="text-xs leading-relaxed text-zinc-400">
                React + TanStack Router + Tailwind. The console hook holds
                the per-server WebSocket and exposes lines, status, stats,
                and dispatch to every tab on the server page.
              </p>
            </CardInner>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}

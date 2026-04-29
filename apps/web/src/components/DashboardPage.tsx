import { Link, useNavigate } from "@tanstack/react-router"

import { Button } from "@workspace/ui/components/button"

import { EventLog } from "@/components/EventLog"
import { ServerList } from "@/components/ServerList"
import { useSession, authClient } from "@/lib/AuthClient"
import { usePanelEvents } from "@/hooks/usePanelEvents"
import { useServers } from "@/hooks/useServers"

/**
 * Authenticated dashboard. Lists the user's servers (admins see all) and
 * surfaces a live event feed driven by the panel-event WS as a smoke
 * surface for the install / lifecycle pipeline.
 */
export const DashboardPage = () => {
  const navigate = useNavigate()
  const { data: session, isPending } = useSession()
  const enabled = !isPending && session !== null
  const { state, events } = usePanelEvents(enabled)
  const serversQuery = useServers()

  const handleSignOut = async () => {
    await authClient.signOut()
    await navigate({ to: "/login" })
  }

  if (isPending) {
    return (
      <div className="bg-background text-foreground flex min-h-svh items-center justify-center text-sm">
        Loading session…
      </div>
    )
  }

  return (
    <div className="bg-background text-foreground flex min-h-svh flex-col">
      <header className="border-border flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="text-base font-semibold">StellarStack</h1>
          <p className="text-muted-foreground text-xs">
            Signed in as {session?.user.email}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/servers/new">
            <Button size="sm">+ New server</Button>
          </Link>
          {session?.user.isAdmin === true ? (
            <>
              <Link to="/admin/nodes">
                <Button variant="outline" size="sm">
                  Nodes
                </Button>
              </Link>
              <Link to="/admin/blueprints">
                <Button variant="outline" size="sm">
                  Blueprints
                </Button>
              </Link>
            </>
          ) : null}
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            Sign out
          </Button>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
        <section>
          <h2 className="mb-2 text-sm font-medium">Your servers</h2>
          <ServerList
            servers={serversQuery.data?.servers ?? []}
            loading={serversQuery.isLoading}
            emptyMessage="No servers yet. Click “+ New server” to provision one."
          />
        </section>
        <EventLog state={state} events={events} />
      </main>
    </div>
  )
}

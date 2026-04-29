import { useNavigate } from "@tanstack/react-router"

import { Button } from "@workspace/ui/components/button"

import { EventLog } from "@/components/EventLog"
import { useSession, authClient } from "@/lib/AuthClient"
import { usePanelEvents } from "@/hooks/usePanelEvents"

/**
 * Authenticated dashboard. For Milestone 4 this is intentionally minimal:
 * proves the session loads, the WS subscriber connects, and panel events
 * arrive in the browser. Real product surfaces (server list, blueprint
 * browser, etc.) replace this in later milestones.
 */
export const DashboardPage = () => {
  const navigate = useNavigate()
  const { data: session, isPending } = useSession()
  const { state, events } = usePanelEvents(!isPending && session !== null)

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
        <Button variant="outline" size="sm" onClick={handleSignOut}>
          Sign out
        </Button>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-6">
        <EventLog state={state} events={events} />
      </main>
    </div>
  )
}

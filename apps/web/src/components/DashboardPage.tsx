import { Link } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  PlusSignFreeIcon,
  Settings02FreeIcon,
} from "@hugeicons/core-free-icons"

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"

import { ServerList } from "@/components/ServerList"
import { useSession, authClient } from "@/lib/AuthClient"
import { useTheme } from "@/components/ThemeProvider"
import { useServers } from "@/hooks/useServers"
import { useNavigate } from "@tanstack/react-router"

const initials = (name: string): string => {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  if (parts.length === 0) {
    return "?"
  }
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?"
}

/**
 * Landing page after sign-in. Single-pane server list; admin entry, new
 * server, and the user popover live in the header rather than a sidebar
 * — no sub-navigation needed at this level.
 */
export const DashboardPage = () => {
  const { data: session, isPending } = useSession()
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const serversQuery = useServers()

  if (isPending) {
    return (
      <div className="bg-background text-foreground flex min-h-svh items-center justify-center text-sm">
        Loading session…
      </div>
    )
  }

  const user = session?.user

  const handleSignOut = async () => {
    await authClient.signOut()
    await navigate({ to: "/login" })
  }

  return (
    <div className="bg-background text-foreground flex min-h-svh flex-col">
      <header className="border-border flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="text-base font-semibold">StellarStack</h1>
          <p className="text-muted-foreground text-xs">Servers</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/servers/new">
            <Button size="sm">
              <HugeiconsIcon icon={PlusSignFreeIcon} />
              New server
            </Button>
          </Link>
          {user?.isAdmin === true ? (
            <Link to="/admin/nodes">
              <Button variant="outline" size="sm">
                <HugeiconsIcon icon={Settings02FreeIcon} />
                Admin
              </Button>
            </Link>
          ) : null}
          {user !== undefined ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="border-border hover:bg-muted/50 flex items-center gap-2 rounded-md border px-2 py-1 text-xs"
                >
                  <Avatar className="size-6 rounded-md">
                    <AvatarFallback className="rounded-md text-[0.6rem]">
                      {initials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline">{user.name}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="text-muted-foreground text-[0.65rem]">
                  Signed in as
                </DropdownMenuLabel>
                <DropdownMenuLabel className="pt-0 text-xs font-normal">
                  {user.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault()
                    setTheme(theme === "dark" ? "light" : "dark")
                  }}
                >
                  {theme === "dark" ? "Light theme" : "Dark theme"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleSignOut}>
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
        <section>
          <h2 className="mb-2 text-sm font-medium">Your servers</h2>
          <ServerList
            servers={serversQuery.data?.servers ?? []}
            loading={serversQuery.isLoading}
            emptyMessage="No servers yet. Click “+ New server” to provision one."
          />
        </section>
      </main>
    </div>
  )
}

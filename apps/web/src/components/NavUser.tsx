import { Link, useNavigate } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Logout02Icon,
  Moon02Icon,
  Sun02Icon,
  UserCircleIcon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons"

import {
  Avatar,
  AvatarFallback,
} from "@workspace/ui/components/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@workspace/ui/components/sidebar"

import { authClient, useSession } from "@/lib/AuthClient"
import { useTheme } from "@/components/ThemeProvider"

const initials = (name: string): string => {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  if (parts.length === 0) {
    return "?"
  }
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?"
}

/**
 * Sidebar-foot user widget. Mirrors the shadcn `NavUser` example: Avatar
 * + name + email in a SidebarMenuButton, with a DropdownMenu that exposes
 * the theme toggle, an admin link (when applicable), and sign-out. Used
 * at the bottom of every sidebar shell — server and admin.
 *
 * Renders its own `SidebarMenu` wrapper so callers can drop it straight
 * into `<SidebarFooter>` like the shadcn example does.
 */
export const NavUser = () => {
  const { data: session } = useSession()
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const { state, isMobile } = useSidebar()

  const user = session?.user
  if (user === undefined) {
    return null
  }

  const handleSignOut = async () => {
    await authClient.signOut()
    await navigate({ to: "/login" })
  }

  const collapsed = state === "collapsed"

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="size-8 rounded-lg">
                <AvatarFallback className="rounded-lg">
                  {initials(user.name)}
                </AvatarFallback>
              </Avatar>
              {!collapsed ? (
                <>
                  <div className="grid flex-1 text-left text-xs leading-tight">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="text-muted-foreground truncate text-[0.65rem]">
                      {user.email}
                    </span>
                  </div>
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    className="size-3.5 -rotate-90"
                  />
                </>
              ) : null}
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side={isMobile ? "bottom" : "right"}
            align="end"
            className="min-w-56 rounded-lg"
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-[0.65rem]">
              Signed in as
            </DropdownMenuLabel>
            <DropdownMenuLabel className="pt-0 text-xs font-normal">
              {user.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {user.isAdmin === true ? (
              <DropdownMenuItem asChild>
                <Link to="/admin/nodes">
                  <HugeiconsIcon icon={UserCircleIcon} />
                  <span>Admin</span>
                </Link>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault()
                setTheme(theme === "dark" ? "light" : "dark")
              }}
            >
              <HugeiconsIcon
                icon={theme === "dark" ? Sun02Icon : Moon02Icon}
              />
              <span>{theme === "dark" ? "Light theme" : "Dark theme"}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleSignOut}>
              <HugeiconsIcon icon={Logout02Icon} />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

import type { CSSProperties } from "react"
import { Link, useLocation } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  ServerStack02Icon,
  Settings02Icon,
  UserCircleIcon,
  Logout02Icon,
  Moon02Icon,
  Sun02Icon,
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
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@workspace/ui/components/sidebar"

import { NavMain } from "@/components/NavMain"
import { authClient, useSession } from "@/lib/AuthClient"
import { useTheme } from "@/components/ThemeProvider"
import { useNavigate } from "@tanstack/react-router"

const initials = (name: string): string => {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  if (parts.length === 0) return "?"
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?"
}

const MainNavUser = () => {
  const { data: session } = useSession()
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const { state, isMobile } = useSidebar()

  const user = session?.user
  if (user === undefined) return null

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
                {user.image !== null && user.image !== undefined ? (
                  <img src={user.image} alt={user.name} className="size-full rounded-lg object-cover" />
                ) : null}
                <AvatarFallback className="rounded-lg">{initials(user.name)}</AvatarFallback>
              </Avatar>
              {!collapsed ? (
                <>
                  <div className="grid flex-1 text-left text-xs leading-tight">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="text-muted-foreground truncate text-[0.65rem]">{user.email}</span>
                  </div>
                  <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5 -rotate-90" />
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
            <DropdownMenuLabel className="text-muted-foreground text-[0.65rem]">Signed in as</DropdownMenuLabel>
            <DropdownMenuLabel className="pt-0 text-xs font-normal">{user.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/profile">
                <HugeiconsIcon icon={UserCircleIcon} />
                <span>Profile</span>
              </Link>
            </DropdownMenuItem>
            {user.isAdmin === true && (
              <DropdownMenuItem asChild>
                <Link to="/admin/nodes">
                  <HugeiconsIcon icon={Settings02Icon} />
                  <span>Admin panel</span>
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onSelect={(e) => { e.preventDefault(); setTheme(theme === "dark" ? "light" : "dark") }}
            >
              <HugeiconsIcon icon={theme === "dark" ? Sun02Icon : Moon02Icon} />
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

export const MainSidebar = ({ ...props }: React.ComponentProps<typeof Sidebar>) => {
  const location = useLocation()

  const items = [
    {
      title: "Servers",
      icon: ServerStack02Icon,
      to: "/dashboard" as string,
      isActive: location.pathname === "/dashboard",
    },
    {
      title: "New server",
      icon: Add01Icon,
      to: "/servers/new" as string,
      isActive: location.pathname === "/servers/new",
    },
  ]

  return (
    <Sidebar
      collapsible="icon"
      style={{ "--sidebar-width": "calc(var(--spacing) * 60)" } as CSSProperties}
      {...props}
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild className="data-[slot=sidebar-menu-button]:p-1.5!">
              <Link to="/dashboard">
                <span className="bg-sidebar-accent text-sidebar-accent-foreground flex aspect-square size-8 items-center justify-center rounded-lg font-bold text-sm">
                  S
                </span>
                <span className="font-semibold text-sm">StellarStack</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={items} />
      </SidebarContent>
      <SidebarFooter>
        <MainNavUser />
      </SidebarFooter>
    </Sidebar>
  )
}

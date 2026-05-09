import { useRef, useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { AnimatePresence, motion } from "framer-motion"

import { DuoIcon } from "@/components/DuoIcon"
import { type IconName } from "@/components/Icon"
import { authClient, useSession } from "@/lib/AuthClient"
import { useTheme } from "@/components/ThemeProvider"
import { dicebearAvatarUrl } from "@/lib/Avatar"
import { useSidebar } from "@workspace/ui/components/sidebar"

type NavAction =
  | { label: string; icon: IconName; href: "/admin/nodes" | "/account" }
  | { label: string; icon: IconName; onClick: () => void }

/**
 * Sidebar-foot user widget. Shows avatar + name + ellipsis trigger; clicking
 * the row or the ··· button opens an upward popup with theme toggle, admin
 * link, and sign-out.
 */
export const NavUser = () => {
  const { data: session } = useSession()
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const { state } = useSidebar()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const user = session?.user
  if (user === undefined) return null

  const collapsed = state === "collapsed"

  const handleSignOut = async () => {
    setOpen(false)
    await authClient.signOut()
    await navigate({ to: "/login" })
  }

  const actions: NavAction[] = [
    ...(user.isAdmin === true
      ? [{ label: "Admin Panel", icon: "shield-user" as IconName, href: "/admin/nodes" as const }]
      : []),
    {
      label: theme === "dark" ? "Light theme" : "Dark theme",
      icon: theme === "dark" ? ("sun" as IconName) : ("moon" as IconName),
      onClick: () => {
        setTheme(theme === "dark" ? "light" : "dark")
        setOpen(false)
      },
    },
    { label: "Account", icon: "user-circle" as IconName, href: "/account" as const },
  ]

  const avatarSrc = user.image ?? dicebearAvatarUrl(user.name)

  return (
    <div ref={ref} className="relative">
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="backdrop"
              className="fixed inset-0 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              key="popup"
              initial={{ opacity: 0, y: 6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="absolute bottom-full left-0 right-0 z-50 mb-1.5 overflow-hidden rounded-xl border border-white/8 bg-[#130f0c] shadow-2xl"
            >
              <div className="flex items-center gap-2.5 border-b border-white/6 px-3 py-2.5">
                <img
                  src={avatarSrc}
                  alt={user.name}
                  className="size-7 shrink-0 rounded-lg bg-zinc-800 object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-zinc-100">{user.name}</p>
                  <p className="truncate text-[10px] text-zinc-500">{user.email}</p>
                </div>
              </div>
              <div className="p-1">
                {actions.map((action) =>
                  "href" in action ? (
                    <Link
                      key={action.label}
                      to={action.href}
                      onClick={() => setOpen(false)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100"
                    >
                      <DuoIcon name={action.icon} className="size-3.5 shrink-0" />
                      {action.label}
                    </Link>
                  ) : (
                    <button
                      key={action.label}
                      onClick={action.onClick}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100"
                    >
                      <DuoIcon name={action.icon} className="size-3.5 shrink-0" />
                      {action.label}
                    </button>
                  )
                )}
                <div className="my-1 border-t border-white/6" />
                <button
                  onClick={() => void handleSignOut()}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
                >
                  <DuoIcon name="logout" className="size-3.5 shrink-0" />
                  Sign out
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <button
        onClick={() => setOpen((v) => !v)}
        className={`group flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/5 ${collapsed ? "justify-center px-0" : ""}`}
      >
        <img
          src={avatarSrc}
          alt={user.name}
          className="size-7 shrink-0 rounded-lg bg-zinc-800 object-cover"
        />
        {!collapsed && (
          <>
            <div className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate text-xs font-medium text-foreground">
                {user.name}
              </span>
              <span className="truncate text-[0.65rem] text-muted-foreground">
                {user.email}
              </span>
            </div>
            <DuoIcon
              name="more-horizontal"
              className="size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
            />
          </>
        )}
      </button>
    </div>
  )
}

import { useRef, useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Logout02Icon,
  Moon02Icon,
  MoreHorizontalIcon,
  ShieldUserIcon,
  Sun02Icon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons"
import { AnimatePresence, motion } from "framer-motion"

import { authClient, useSession } from "@/lib/AuthClient"
import { useTheme } from "@/components/ThemeProvider"
import { useSidebar } from "@workspace/ui/components/sidebar"

const initials = (name: string): string => {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  if (parts.length === 0) return "?"
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?"
}

const avatarGradient = (name: string): string => {
  const gradients = [
    "from-violet-500 to-indigo-500",
    "from-blue-500 to-cyan-500",
    "from-emerald-500 to-teal-500",
    "from-orange-500 to-pink-500",
    "from-rose-500 to-fuchsia-500",
    "from-amber-500 to-orange-500",
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0
  return gradients[Math.abs(hash) % gradients.length] ?? gradients[0]
}

type NavAction =
  | { label: string; icon: typeof ShieldUserIcon; href: "/admin/nodes" | "/profile" }
  | { label: string; icon: typeof Sun02Icon; onClick: () => void }

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
      ? [{ label: "Admin Panel", icon: ShieldUserIcon, href: "/admin/nodes" as const }]
      : []),
    {
      label: theme === "dark" ? "Light theme" : "Dark theme",
      icon: theme === "dark" ? Sun02Icon : Moon02Icon,
      onClick: () => {
        setTheme(theme === "dark" ? "light" : "dark")
        setOpen(false)
      },
    },
    { label: "Profile", icon: UserCircleIcon, href: "/profile" as const },
  ]

  const gradient = avatarGradient(user.name)

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
              className="absolute bottom-full left-0 right-0 z-50 mb-1.5 overflow-hidden rounded-xl border border-white/8 bg-[#1e1f26] shadow-2xl"
            >
              <div className="flex items-center gap-2.5 border-b border-white/6 px-3 py-2.5">
                <span
                  className={`flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${gradient} text-[11px] font-bold text-white`}
                >
                  {initials(user.name)}
                </span>
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
                      <HugeiconsIcon icon={action.icon} className="size-3.5 shrink-0" />
                      {action.label}
                    </Link>
                  ) : (
                    <button
                      key={action.label}
                      onClick={action.onClick}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100"
                    >
                      <HugeiconsIcon icon={action.icon} className="size-3.5 shrink-0" />
                      {action.label}
                    </button>
                  )
                )}
                <div className="my-1 border-t border-white/6" />
                <button
                  onClick={() => void handleSignOut()}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
                >
                  <HugeiconsIcon icon={Logout02Icon} className="size-3.5 shrink-0" />
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
        <span
          className={`flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${gradient} text-[11px] font-bold text-white`}
        >
          {initials(user.name)}
        </span>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-300">
              {user.name}
            </span>
            <HugeiconsIcon
              icon={MoreHorizontalIcon}
              className="size-3.5 shrink-0 text-zinc-600 transition-colors group-hover:text-zinc-400"
            />
          </>
        )}
      </button>
    </div>
  )
}

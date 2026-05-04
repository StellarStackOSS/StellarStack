import { useEffect } from "react"
import { useLocation } from "@tanstack/react-router"

import { useServer } from "@/hooks/useServers"

const SUFFIX = "StellarStack"

const sectionTitle = (path: string): string => {
  if (path === "/" || path === "/dashboard") return "Dashboard"
  if (path === "/login") return "Sign in"
  if (path === "/register") return "Register"
  if (path === "/profile") return "Profile"
  if (path === "/servers/new") return "New server"
  if (path.startsWith("/admin/audit")) return "Audit log · Admin"
  if (path.startsWith("/admin/blueprints")) return "Blueprints · Admin"
  if (path.startsWith("/admin/nodes")) return "Nodes · Admin"
  if (path.startsWith("/admin/users")) return "Users · Admin"
  if (path.startsWith("/admin/servers")) return "Servers · Admin"
  if (path === "/admin" || path.startsWith("/admin")) return "Admin"
  return ""
}

const serverTabTitle = (sub: string): string => {
  if (sub === "" || sub === "/") return "Overview"
  if (sub === "/files") return "Files"
  if (sub === "/backups") return "Backups"
  if (sub === "/schedules") return "Schedules"
  if (sub === "/users") return "Users"
  if (sub === "/network") return "Network"
  if (sub === "/startup") return "Startup"
  if (sub === "/instances") return "Instances"
  if (sub === "/activity") return "Activity"
  if (sub === "/settings") return "Settings"
  if (sub === "/transfer") return "Transfer"
  return ""
}

const extractServerId = (path: string): string | null => {
  const match = /^\/servers\/([0-9a-f-]{8,})/.exec(path)
  return match !== null ? (match[1] ?? null) : null
}

/**
 * Drives the document.title from the active route. On server pages we
 * append the server's display name once it loads (via useServer); on
 * any other page we derive the title from the path. Renders nothing.
 */
export const PageTitle = () => {
  const location = useLocation()
  const path = location.pathname
  const serverId = extractServerId(path)
  const serverQuery = useServer(serverId)

  useEffect(() => {
    let title = ""
    if (serverId !== null) {
      const sub = path.slice(`/servers/${serverId}`.length)
      const tab = serverTabTitle(sub)
      const name = serverQuery.data?.server.name ?? ""
      title = name !== "" ? `${tab} · ${name}` : tab
    } else {
      title = sectionTitle(path)
    }
    document.title = title === "" ? SUFFIX : `${title} · ${SUFFIX}`
  }, [path, serverId, serverQuery.data?.server.name])

  return null
}

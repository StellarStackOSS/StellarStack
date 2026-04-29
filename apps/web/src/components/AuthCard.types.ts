import type { ReactNode } from "react"

/**
 * Props accepted by `AuthCard` — a centred card frame shared by the login
 * and register pages.
 */
export type AuthCardProps = {
  title: string
  subtitle?: string
  footer?: ReactNode
  children: ReactNode
}

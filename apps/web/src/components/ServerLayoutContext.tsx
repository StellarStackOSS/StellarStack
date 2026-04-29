import { createContext, useContext } from "react"

import type { ServerLayoutContextValue } from "@/components/ServerLayoutContext.types"

/**
 * React context for the per-server layout. `useServerLayout` throws if
 * a child page is accidentally rendered outside `ServerLayout` so the
 * mistake surfaces loudly during development.
 */
export const ServerLayoutContext =
  createContext<ServerLayoutContextValue | null>(null)

export const useServerLayout = (): ServerLayoutContextValue => {
  const value = useContext(ServerLayoutContext)
  if (value === null) {
    throw new Error("useServerLayout must be used inside ServerLayout")
  }
  return value
}

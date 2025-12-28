"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { AuthProvider } from "./auth-provider"
import { QueryProvider } from "./query-provider"
import { CommandPalette } from "./command-palette"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      enableColorScheme
    >
      <QueryProvider>
        <AuthProvider>
          {children}
          <CommandPalette />
        </AuthProvider>
      </QueryProvider>
    </NextThemesProvider>
  )
}

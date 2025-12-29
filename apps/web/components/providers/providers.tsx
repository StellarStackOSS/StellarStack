"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { AuthProvider } from "@/components/auth-provider"
import { QueryProvider } from "@/components/query-provider"
import { WebSocketProvider } from "@/components/websocket-provider"
import { CommandPalette } from "@/components/command-palette"

export const Providers = ({ children }: { children: React.ReactNode }) => {
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
          <WebSocketProvider>
            {children}
            <CommandPalette />
          </WebSocketProvider>
        </AuthProvider>
      </QueryProvider>
    </NextThemesProvider>
  );
};

"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { AuthProvider } from "hooks/auth-provider";
import { QueryProvider } from "components/providers/query-provider";
import { WebSocketProvider } from "@/components/websocket-provider";

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
          <WebSocketProvider>{children}</WebSocketProvider>
        </AuthProvider>
      </QueryProvider>
    </NextThemesProvider>
  );
};

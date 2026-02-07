"use client";

import * as React from "react";
import { AuthProvider } from "@/hooks/auth-provider/auth-provider";
import { QueryProvider } from "@/components/providers/QueryProvider/QueryProvider";
import { WebSocketProvider } from "@/components/providers/WebSocketProvider/WebSocketProvider";
import { CommandMenuProvider } from "@/components/CommandMenu/CommandMenuProvider";
import { CommandMenu } from "@/components/CommandMenu/CommandMenu";
import { ThemeProvider } from "@/contexts/ThemeContext";

/**
 * Root providers component
 * Wraps the entire app with necessary context providers
 */
export const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <ThemeProvider>
      <QueryProvider>
        <AuthProvider>
          <CommandMenuProvider>
            <WebSocketProvider>
              {children}
              <CommandMenu />
            </WebSocketProvider>
          </CommandMenuProvider>
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  );
};

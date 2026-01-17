"use client"

import * as React from "react"
import {AuthProvider} from "@/hooks/auth-provider/auth-provider"
import {QueryProvider} from "@/components/providers/query-provider"
import {WebSocketProvider} from "@/components/websocket-provider"

export const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <QueryProvider>
      <AuthProvider>
        <WebSocketProvider>
          {children}
        </WebSocketProvider>
      </AuthProvider>
    </QueryProvider>
  );
};

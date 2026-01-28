"use client";

import * as React from "react";
import { AuthProvider } from "@/hooks/auth-provider/auth-provider";
import { QueryProvider } from "@/components/providers/QueryProvider/QueryProvider";
import { WebSocketProvider } from "@/components/providers/WebSocketProvider/WebSocketProvider";

export const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <QueryProvider>
      <AuthProvider>
        <WebSocketProvider>{children}</WebSocketProvider>
      </AuthProvider>
    </QueryProvider>
  );
};

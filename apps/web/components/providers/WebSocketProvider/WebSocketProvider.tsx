"use client";

import { createContext, useContext, ReactNode } from "react";
import { useGlobalWebSocket } from "@/hooks/UseWebSocket";

interface WebSocketContextType {
  isConnected: boolean;
}

const WebSocketContext = createContext<WebSocketContextType>({
  isConnected: false,
});

export const useWebSocketStatus = () => {
  return useContext(WebSocketContext);
};

interface WebSocketProviderProps {
  children: ReactNode;
}

export const WebSocketProvider = ({ children }: WebSocketProviderProps) => {
  const { isConnected } = useGlobalWebSocket();

  return <WebSocketContext.Provider value={{ isConnected }}>{children}</WebSocketContext.Provider>;
};

"use client";

import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  useState,
} from "react";
import { useServer as useServerQuery, useServerConsole, useServerMutations } from "@/hooks/queries/UseServers";
import { useWebSocket } from "@/hooks/UseWebSocket";
import { useAuth } from "@/hooks/AuthProvider/AuthProvider";
import type { Server, ConsoleInfo } from "@/lib/Api";
import { servers } from "@/lib/Api";
import { PlaySoundEffect } from "@/hooks/UseSoundEffects";
import { toast } from "sonner";

// Server access context with permission info
export interface ServerAccessContext {
  isOwner: boolean;
  isAdmin: boolean;
  isMember: boolean;
  permissions: string[];
}

// Loading states for power actions
export interface PowerActionLoadingStates {
  start: boolean;
  stop: boolean;
  restart: boolean;
  kill: boolean;
}

interface ServerContextType {
  server: Server | null;
  consoleInfo: ConsoleInfo | null;
  serverAccess: ServerAccessContext | null;
  isLoading: boolean;
  isInstalling: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  refreshConsoleInfo: () => Promise<void>;

  // Actions
  start: () => Promise<void>;
  stop: () => Promise<void>;
  restart: () => Promise<void>;
  kill: () => Promise<void>;
  sendCommand: (command: string) => Promise<void>;

  // Loading states for power actions
  powerActionLoading: PowerActionLoadingStates;
}

const ServerContext = createContext<ServerContextType | null>(null);

export const useServer = () => {
  const context = useContext(ServerContext);
  if (!context) {
    throw new Error("useServer must be used within a ServerProvider");
  }
  return context;
};

interface ServerProviderProps {
  serverId: string;
  children: React.ReactNode;
}

export const ServerProvider = ({ serverId, children }: ServerProviderProps) => {
  // Track previous status to detect when installation completes
  const prevStatusRef = useRef<string | null>(null);
  const { user, isAdmin } = useAuth();

  // Server access state
  const [serverAccess, setServerAccess] = useState<ServerAccessContext | null>(null);

  // WebSocket connection for real-time updates
  const { isConnected: wsConnected } = useWebSocket({ serverIds: [serverId] });

  // React Query hooks - poll less frequently when WebSocket is connected
  const {
    data: server = null,
    isLoading,
    error: serverError,
    refetch: refetchServer,
  } = useServerQuery(serverId, {
    // When WebSocket connected: poll every 30s as fallback, otherwise poll faster
    // During installation: poll every 2s regardless (installation progress isn't pushed via WS)
    refetchInterval: prevStatusRef.current === "INSTALLING" ? 2000 : wsConnected ? 30000 : 5000,
  });

  // Compute server access based on user and server
  useEffect(() => {
    if (!server || !user) {
      setServerAccess(null);
      return;
    }

    const isOwner = server.ownerId === user.id;

    // If user is admin or owner, they have full access
    if (isAdmin || isOwner) {
      setServerAccess({
        isOwner,
        isAdmin,
        isMember: false,
        permissions: ["*"],
      });
      return;
    }

    // Otherwise, check if user is a member and get their permissions
    // For now, we'll try to fetch members list and find the user's membership
    // If we can't access it, we likely don't have permissions anyway
    servers.members
      .list(serverId)
      .then((members) => {
        const membership = members.find((m) => m.userId === user.id);
        if (membership) {
          setServerAccess({
            isOwner: false,
            isAdmin: false,
            isMember: true,
            permissions: membership.permissions,
          });
        } else {
          // User has some access (since they can view the server) but not a member
          // This shouldn't normally happen since requireServerAccess middleware checks this
          setServerAccess({
            isOwner: false,
            isAdmin: false,
            isMember: false,
            permissions: [],
          });
        }
      })
      .catch(() => {
        // If we can't fetch members, user might not have users.read permission
        // Set minimal access
        setServerAccess({
          isOwner: false,
          isAdmin: false,
          isMember: true, // Assume member since they can access the server
          permissions: [], // Unknown permissions - rely on API to enforce
        });
      });
  }, [server, user, isAdmin, serverId]);

  // Only fetch console info when server exists and is not suspended
  const { data: consoleInfo = null, refetch: refetchConsoleInfo } = useServerConsole(
    server && !server.suspended ? serverId : undefined
  );

  const mutations = useServerMutations();

  // Convert React Query error to string
  const error = serverError ? "Failed to fetch server" : null;

  // Check if server is currently installing
  const isInstalling = server?.status === "INSTALLING";

  // Play sound when server finishes installing
  useEffect(() => {
    if (server?.status) {
      // If previous status was INSTALLING and new status is not INSTALLING, installation completed
      if (prevStatusRef.current === "INSTALLING" && server.status !== "INSTALLING") {
        PlaySoundEffect("jobDone");
        toast.success("Server installation complete!");
      }
      prevStatusRef.current = server.status;
    }
  }, [server?.status]);

  const refetch = useCallback(async () => {
    await refetchServer();
  }, [refetchServer]);

  const refreshConsoleInfo = useCallback(async () => {
    await refetchConsoleInfo();
  }, [refetchConsoleInfo]);

  const start = useCallback(async () => {
    try {
      await mutations.start.mutateAsync(serverId);
      toast.success("Server starting...");
    } catch (err) {
      toast.error("Failed to start server");
      throw err;
    }
  }, [serverId, mutations.start]);

  const stop = useCallback(async () => {
    try {
      await mutations.stop.mutateAsync(serverId);
      toast.success("Server stopping...");
    } catch (err) {
      toast.error("Failed to stop server");
      throw err;
    }
  }, [serverId, mutations.stop]);

  const restart = useCallback(async () => {
    try {
      await mutations.restart.mutateAsync(serverId);
      toast.success("Server restarting...");
    } catch (err) {
      toast.error("Failed to restart server");
      throw err;
    }
  }, [serverId, mutations.restart]);

  const kill = useCallback(async () => {
    try {
      await mutations.kill.mutateAsync(serverId);
      toast.success("Server killed");
    } catch (err) {
      toast.error("Failed to kill server");
      throw err;
    }
  }, [serverId, mutations.kill]);

  const sendCommand = useCallback(
    async (command: string) => {
      try {
        await mutations.sendCommand.mutateAsync({ id: serverId, command });
      } catch (err) {
        toast.error("Failed to send command");
        throw err;
      }
    },
    [serverId, mutations.sendCommand]
  );

  // Compute loading states from mutations
  const powerActionLoading = useMemo<PowerActionLoadingStates>(
    () => ({
      start: mutations.start.isPending,
      stop: mutations.stop.isPending,
      restart: mutations.restart.isPending,
      kill: mutations.kill.isPending,
    }),
    [
      mutations.start.isPending,
      mutations.stop.isPending,
      mutations.restart.isPending,
      mutations.kill.isPending,
    ]
  );

  const value = useMemo<ServerContextType>(
    () => ({
      server,
      consoleInfo,
      serverAccess,
      isLoading,
      isInstalling,
      error,
      refetch,
      refreshConsoleInfo,
      start,
      stop,
      restart,
      kill,
      sendCommand,
      powerActionLoading,
    }),
    [
      server,
      consoleInfo,
      serverAccess,
      isLoading,
      isInstalling,
      error,
      refetch,
      refreshConsoleInfo,
      start,
      stop,
      restart,
      kill,
      sendCommand,
      powerActionLoading,
    ]
  );

  return <ServerContext.Provider value={value}>{children}</ServerContext.Provider>;
};

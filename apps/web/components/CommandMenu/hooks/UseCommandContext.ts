"use client";

import { useAuth } from "@/hooks/AuthProvider/AuthProvider";
import { useRouter, usePathname, useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { servers } from "@/lib/Api";
import { CommandContext } from "@/components/CommandMenu/commands/types";

/**
 * Hook to get the current command context based on app state
 * Detects current page, server, user permissions, etc.
 * @returns CommandContext with current app state
 */
export const useCommandContext = (): CommandContext => {
  const { user, isAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();

  // Extract server ID from route params
  const serverId = typeof params.id === "string" ? params.id : undefined;

  // Fetch server data if on server page
  const { data: server } = useQuery({
    queryKey: ["server", serverId],
    queryFn: () => (serverId ? servers.get(serverId) : Promise.resolve(null)),
    enabled: !!serverId,
  });

  return {
    serverId,
    server,
    isAdmin: isAdmin || false,
    permissions: [],
    pathname,
    router,
    userId: user?.id,
  };
};

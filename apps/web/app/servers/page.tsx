"use client";

import { useState, useEffect, type JSX } from "react";
import { useRouter } from "next/navigation";
import { useTheme as useNextTheme } from "next-themes";
import { cn } from "@workspace/ui/lib/utils";
import { Button } from "@workspace/ui/components/button";
import { AnimatedBackground } from "@workspace/ui/components/animated-background";
import { FloatingDots } from "@workspace/ui/components/floating-particles";
import { BsServer, BsChevronRight, BsBoxArrowRight } from "react-icons/bs";
import { servers as serversApi } from "@/lib/api";
import type { Server } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { toast } from "sonner";
import { TextureButton } from "@workspace/ui/components/texture-button";

type ServerStatus =
  | "INSTALLING"
  | "STARTING"
  | "RUNNING"
  | "STOPPING"
  | "STOPPED"
  | "SUSPENDED"
  | "MAINTENANCE"
  | "RESTORING"
  | "ERROR";

const ServersPage = (): JSX.Element | null => {
  const router = useRouter();
  const { setTheme, resolvedTheme } = useNextTheme();
  const { signOut, isAdmin } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [servers, setServers] = useState<Server[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const fetchServers = async () => {
      try {
        const data = await serversApi.list();
        setServers(data);
      } catch (error) {
        toast.error("Failed to fetch servers");
      } finally {
        setIsLoading(false);
      }
    };

    fetchServers();
  }, []);

  const isDark = mounted ? resolvedTheme === "dark" : true;

  const handleServerSelect = (serverId: string) => {
    router.push(`/servers/${serverId}/overview`);
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  if (!mounted) return null;

  const getStatusColor = (status: ServerStatus) => {
    switch (status) {
      case "RUNNING":
        return "text-green-500 border-green-500";
      case "STOPPED":
        return "text-zinc-500 border-zinc-500";
      case "STARTING":
      case "STOPPING":
      case "MAINTENANCE":
        return "text-amber-500 border-amber-500";
      case "INSTALLING":
      case "RESTORING":
        return "text-blue-500 border-blue-500";
      case "SUSPENDED":
        return "text-red-400 border-red-400";
      case "ERROR":
        return "text-red-500 border-red-500";
      default:
        return "text-zinc-500 border-zinc-500";
    }
  };

  const getLocationString = (server: Server) => {
    if (server.node?.location) {
      const loc = server.node.location;
      const parts = [loc.city, loc.country].filter(Boolean);
      return parts.length > 0 ? parts.join(", ") : server.node.displayName;
    }
    return server.node?.displayName || "Unknown";
  };

  const getGameType = (server: Server) => {
    return server.blueprint?.name || "Unknown";
  };

  return (
    <div
      className={cn(
        "relative min-h-svh transition-colors",
        isDark ? "bg-[#0b0b0a]" : "bg-[#f5f5f4]"
      )}
    >
      <AnimatedBackground isDark={isDark} />
      <FloatingDots isDark={isDark} count={15} />

      <div className="relative p-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1
                className={cn(
                  "text-xl font-light tracking-wider",
                  isDark ? "text-zinc-100" : "text-zinc-800"
                )}
              >
                YOUR SERVERS
              </h1>
              <p className={cn("mt-1 text-xs", isDark ? "text-zinc-500" : "text-zinc-500")}>
                Select a server to manage
              </p>
            </div>
            <div className="flex w-1/4 items-center gap-2">
              {isAdmin && (
                <TextureButton onClick={() => router.push("/admin")} variant="minimal">
                  <span className="uppercase">Admin</span>
                </TextureButton>
              )}
              <TextureButton onClick={handleSignOut}>
                <span className="uppercase">Sign Out</span>
              </TextureButton>
            </div>
          </div>

          {/* Server List */}
          <div className="space-y-4">
            {isLoading ? (
              <div
                className={cn(
                  "py-12 text-center text-sm",
                  isDark ? "text-zinc-500" : "text-zinc-400"
                )}
              >
                Loading servers...
              </div>
            ) : servers.length === 0 ? (
              <div className={"text-primary py-12 text-center text-xs"}>No servers found.</div>
            ) : (
              servers.map((server) => (
                <button
                  key={server.id}
                  onClick={() => handleServerSelect(server.id)}
                  className={cn(
                    "group relative w-full cursor-pointer border p-6 text-left transition-all hover:scale-[1.01]",
                    isDark
                      ? "border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] shadow-lg shadow-black/20 hover:border-zinc-700"
                      : "border-zinc-300 bg-gradient-to-b from-white via-zinc-50 to-zinc-100 shadow-lg shadow-zinc-400/20 hover:border-zinc-400"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          "border p-3",
                          isDark ? "border-zinc-700 bg-zinc-800/50" : "border-zinc-300 bg-zinc-100"
                        )}
                      >
                        <BsServer
                          className={cn("h-6 w-6", isDark ? "text-zinc-400" : "text-zinc-600")}
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <h2
                            className={cn(
                              "text-sm font-medium tracking-wider uppercase",
                              isDark ? "text-zinc-100" : "text-zinc-800"
                            )}
                          >
                            {server.name}
                          </h2>
                          <span
                            className={cn(
                              "border px-2 py-0.5 text-[10px] font-medium tracking-wider uppercase",
                              getStatusColor(server.status)
                            )}
                          >
                            {server.status}
                          </span>
                        </div>
                        <div
                          className={cn(
                            "mt-1 flex items-center gap-4 text-xs",
                            isDark ? "text-zinc-500" : "text-zinc-500"
                          )}
                        >
                          <span>{getGameType(server)}</span>
                          <span>-</span>
                          <span>{server.memory}MB RAM</span>
                          <span>-</span>
                          <span>{getLocationString(server)}</span>
                        </div>
                        {server.description && (
                          <div
                            className={cn(
                              "mt-2 text-xs",
                              isDark ? "text-zinc-600" : "text-zinc-400"
                            )}
                          >
                            {server.description}
                          </div>
                        )}
                      </div>
                    </div>
                    <BsChevronRight
                      className={cn(
                        "h-5 w-5 transition-transform group-hover:translate-x-1",
                        isDark
                          ? "text-zinc-600 group-hover:text-zinc-400"
                          : "text-zinc-400 group-hover:text-zinc-600"
                      )}
                    />
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServersPage;

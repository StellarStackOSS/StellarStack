"use client";

import { type JSX, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TextureButton } from "@stellarUI/components/TextureButton";
import { BsChevronRight } from "react-icons/bs";
import type { Server } from "@/lib/Api";
import { servers as serversApi } from "@/lib/Api";
import { useAuth } from "@/hooks/AuthProvider/AuthProvider";
import { toast } from "sonner";
import ServerStatusBadge from "@/components/ServerStatusBadge/ServerStatusBadge";
import Spinner from "@stellarUI/components/Spinner/Spinner";
import { renderVersion } from "@/components/UnifiedSidebar/UnifiedSidebar";
import { cn } from "@stellarUI/lib/Utils";

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
  const { signOut, isAdmin } = useAuth();
  const [servers, setServers] = useState<Server[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchServers = async () => {
      try {
        const data = await serversApi.list();
        setServers(data);
      } catch {
        toast.error("Failed to fetch servers");
      } finally {
        setIsLoading(false);
      }
    };

    fetchServers();
  }, []);

  const handleServerSelect = (serverId: string) => {
    router.push(`/servers/${serverId}/overview`);
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  const getLocationString = (server: Server) => {
    if (server.node?.location) {
      const loc = server.node.location;
      const parts = [loc.city, loc.country].filter(Boolean);
      return parts.length > 0 ? parts.join(", ") : server.node.displayName;
    }
    return server.node?.displayName || "Unknown";
  };

  const getCore = (server: Server) => {
    return server.blueprint?.name || "Unknown";
  };

  return (
    <div className="relative min-h-svh w-full bg-[#0b0b0a] transition-colors">
      {/* Header */}
      <div className="relative flex flex-col items-center p-5 md:p-8">
        <div className="w-full max-w-7xl">
          <div className="mb-8 flex w-full items-center justify-between">
            <div>
              <h1 className="text-xl font-light tracking-wider text-zinc-100">YOUR SERVERS</h1>
              <p className="mt-1 text-xs text-zinc-500">Select a server to manage</p>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <TextureButton onClick={() => router.push("/admin")} variant="accent">
                  <span className="uppercase">Admin</span>
                </TextureButton>
              )}
              <TextureButton variant="minimal" onClick={handleSignOut}>
                <span className="uppercase">Sign Out</span>
              </TextureButton>
            </div>
          </div>

          {/* Server List */}
          <div className="flex flex-col gap-4">
            {isLoading ? (
              <div className="py-12 text-center text-sm text-zinc-500 w-full flex items-center justify-center ">
                <Spinner />
              </div>
            ) : servers.length === 0 ? (
              <div className={"text-primary py-12 text-center text-xs"}>No servers found.</div>
            ) : (
              servers.map((server) => (
                //TODO: FIGURE OUT WHAT TF DO WE WANT TO DO HERE??
                <div
                  className="relative flex cursor-pointer flex-col rounded-lg border border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] p-8 shadow-lg shadow-black/20 transition-all duration-300 select-none hover:scale-101"
                  key={server.id}
                  onClick={() => handleServerSelect(server.id)}
                >
                  <div className="flex w-full items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="flex items-center gap-3">
                          <h2 className="text-sm font-medium tracking-wider text-white uppercase">
                            {server.name}
                          </h2>
                          <ServerStatusBadge server={server} />
                        </div>
                        <div className="mt-1 flex items-center gap-4 text-xs text-zinc-500">
                          <span>{getCore(server)}</span>
                          <span>-</span>
                          <span>{server.memory}MB RAM</span>
                          <span>-</span>
                          <span>{getLocationString(server)}</span>
                        </div>
                        {server.description && (
                          <div className="mt-2 text-xs text-zinc-600">{server.description}</div>
                        )}
                      </div>
                    </div>
                    <BsChevronRight className="h-5 w-5 text-zinc-600 transition-transform group-hover:translate-x-1 group-hover:text-zinc-400" />
                  </div>
                </div>
              ))
            )}
          </div>
          <div
            className={cn("mt-6 text-center text-[10px] tracking-wider text-zinc-600 uppercase")}
          >
            {renderVersion()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServersPage;

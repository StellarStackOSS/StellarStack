"use client";

import {type JSX, useEffect, useState} from "react";
import {useRouter} from "next/navigation";
import {TextureButton} from "@workspace/ui/components/texture-button";
import {AnimatedBackground} from "@workspace/ui/components/animated-background";
import {BsChevronRight} from "react-icons/bs";
import type {Server} from "@/lib/api";
import {servers as serversApi} from "@/lib/api";
import {useAuth} from "hooks/auth-provider";
import {toast} from "sonner";
import ServerStatusBadge from "@/components/ServerStatusBadge/ServerStatusBadge";

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
      } catch (error) {
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
      className="relative min-h-svh transition-colors bg-[#0b0b0a]"
    >
      <AnimatedBackground />

      {/* Header */}
      <div className="relative p-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-light tracking-wider text-zinc-100">
                YOUR SERVERS
              </h1>
              <p className="mt-1 text-xs text-zinc-500">
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
              <div className="py-12 text-center text-sm text-zinc-500">
                Loading servers...
              </div>
            ) : servers.length === 0 ? (
              <div className={"text-primary py-12 text-center text-xs"}>No servers found.</div>
            ) : (
              servers.map((server) => (
                //TODO: FIGURE OUT WHAT TF DO WE WANT TO DO HERE??
                <TextureButton variant="secondary" className="w-full flex flex-row justify-between"
                  key={server.id}
                  onClick={() => handleServerSelect(server.id)}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-4">
                      <div>
                        <img alt="icon" src="/icons/24-storage.svg"/>
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <h2 className="text-sm font-medium tracking-wider uppercase text-white">
                            {server.name}
                          </h2>
                          <ServerStatusBadge server={server}/>
                        </div>
                        <div className="mt-1 flex items-center gap-4 text-xs text-zinc-500">
                          <span>{getGameType(server)}</span>
                          <span>-</span>
                          <span>{server.memory}MB RAM</span>
                          <span>-</span>
                          <span>{getLocationString(server)}</span>
                        </div>
                        {server.description && (
                          <div className="mt-2 text-xs text-zinc-600">
                            {server.description}
                          </div>
                        )}
                      </div>
                    </div>
                    <BsChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-1 text-zinc-600 group-hover:text-zinc-400" />
                  </div>
                </TextureButton>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServersPage;

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@stellarUI/lib/Utils";
import { TextureButton } from "@stellarUI/components/TextureButton";
import Spinner from "@stellarUI/components/Spinner/Spinner";
import { FadeIn } from "@stellarUI/components/FadeIn/FadeIn";
import ConfirmationModal from "@stellarUI/components/ConfirmationModal/ConfirmationModal";
import Input from "@stellarUI/components/Input/Input";
import {
  BsServer,
  BsPlus,
  BsBoxArrowUpRight,
  BsPlay,
  BsStop,
  BsArrowRepeat,
  BsPencil,
  BsTrash,
} from "react-icons/bs";
import { useServerMutations, useServers } from "@/hooks/queries/UseServers";
import type { Server as ServerType } from "@/lib/Api";
import { toast } from "sonner";

export default function AdminServersPage() {
  const router = useRouter();

  // React Query hooks
  const { data: serversList = [], isLoading } = useServers();
  const { remove, start, stop, restart } = useServerMutations();

  // UI state
  const [deleteConfirmServer, setDeleteConfirmServer] = useState<ServerType | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const handleDelete = async () => {
    if (!deleteConfirmServer) return;
    try {
      await remove.mutateAsync(deleteConfirmServer.id);
      toast.success("Server deleted successfully");
      setDeleteConfirmServer(null);
    } catch (error) {
      toast.error("Failed to delete server");
    }
  };

  const handleAction = async (server: ServerType, action: "start" | "stop" | "restart") => {
    try {
      if (action === "start") {
        await start.mutateAsync(server.id);
        toast.success("Server starting...");
      } else if (action === "stop") {
        await stop.mutateAsync(server.id);
        toast.success("Server stopping...");
      } else {
        await restart.mutateAsync(server.id);
        toast.success("Server restarting...");
      }
    } catch (error) {
      toast.error(`Failed to ${action} server`);
    }
  };

  const filteredServers = useMemo(() => {
    if (!searchQuery) return serversList;
    const query = searchQuery.toLowerCase();
    return serversList.filter(
      (server) =>
        server.name.toLowerCase().includes(query) ||
        server.shortId?.toLowerCase().includes(query) ||
        server.status.toLowerCase().includes(query) ||
        server.blueprint?.name?.toLowerCase().includes(query) ||
        server.node?.displayName?.toLowerCase().includes(query) ||
        server.owner?.name?.toLowerCase().includes(query)
    );
  }, [serversList, searchQuery]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "RUNNING":
        return "bg-green-900/30 text-green-400";
      case "STOPPED":
        return "bg-zinc-800 text-zinc-400";
      case "STARTING":
      case "STOPPING":
        return "bg-amber-900/30 text-amber-400";
      default:
        return "bg-zinc-800 text-zinc-500";
    }
  };

  return (
    <FadeIn className="flex min-h-[calc(100svh-1rem)] w-full flex-col">
      <div className="relative flex min-h-[calc(100svh-1rem)] w-full flex-col transition-colors">
        <div className="relative flex min-h-[calc(100svh-1rem)] w-full flex-col rounded-lg bg-black px-4 pb-4">
          {/* Header */}
          <FadeIn delay={0}>
            <div className="mb-6 flex items-center justify-end">
              <div className="flex items-center gap-2">
                <TextureButton
                  variant="primary"
                  size="sm"
                  className="w-fit"
                  onClick={() => router.push("/admin/servers/new")}
                >
                  <BsPlus className="h-4 w-4" />
                  Create Server
                </TextureButton>
              </div>
            </div>
          </FadeIn>

          {/* Search */}
          <FadeIn delay={0.05}>
            <div className="mb-4">
              <Input
                type="text"
                placeholder="Search servers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9"
              />
            </div>
          </FadeIn>

          {/* Servers List */}
          <FadeIn delay={0.1}>
            <div className="flex h-full flex-col rounded-lg border border-white/5 bg-[#090909] p-1 pt-2">
              <div className="flex shrink-0 items-center justify-between pr-2 pb-2 pl-2">
                <div className="flex items-center gap-2 text-xs opacity-50">
                  <BsServer className="h-3 w-3" />
                  Servers
                </div>
                <span className="text-xs text-zinc-500">
                  {filteredServers.length} server{filteredServers.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex flex-1 flex-col rounded-lg border border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] shadow-lg shadow-black/20">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Spinner />
                  </div>
                ) : filteredServers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <BsServer className="mb-4 h-12 w-12 text-zinc-600" />
                    <h3 className="mb-2 text-sm font-medium text-zinc-300">No Servers</h3>
                    <p className="mb-4 text-xs text-zinc-500">
                      {searchQuery
                        ? "No servers match your search."
                        : "Create your first server to get started."}
                    </p>
                    {!searchQuery && (
                      <TextureButton
                        variant="minimal"
                        size="sm"
                        className="w-fit"
                        onClick={() => router.push("/admin/servers/new")}
                      >
                        <BsPlus className="h-4 w-4" />
                        Create Server
                      </TextureButton>
                    )}
                  </div>
                ) : (
                  filteredServers.map((server, index) => (
                    <div
                      key={server.id}
                      className={cn(
                        "flex items-center justify-between p-4 transition-colors hover:bg-zinc-800/20",
                        index !== filteredServers.length - 1 && "border-b border-zinc-800/50"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800/50">
                          <BsServer className="h-5 w-5 text-zinc-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-zinc-100">{server.name}</span>
                            <span
                              className={cn(
                                "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase",
                                getStatusColor(server.status)
                              )}
                            >
                              {server.status}
                            </span>
                            {server.shortId && (
                              <span className="rounded border border-zinc-700 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
                                {server.shortId}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
                            <span>{server.blueprint?.name || "Unknown"}</span>
                            <span className="text-zinc-700">•</span>
                            <span>{server.node?.displayName || "Unknown"}</span>
                            <span className="text-zinc-700">•</span>
                            <span className="font-mono">
                              {server.memory}MB / {server.cpu}%
                            </span>
                            <span className="text-zinc-700">•</span>
                            <span>{server.owner?.name || "Unknown"}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <TextureButton
                          variant="minimal"
                          size="sm"
                          className="w-fit"
                          onClick={() => router.push(`/servers/${server.id}`)}
                        >
                          <BsBoxArrowUpRight className="h-4 w-4" />
                        </TextureButton>
                        {server.status === "STOPPED" && (
                          <TextureButton
                            variant="minimal"
                            size="sm"
                            className="w-fit text-green-400 hover:text-green-300"
                            onClick={() => handleAction(server, "start")}
                            disabled={start.isPending}
                          >
                            <BsPlay className="h-4 w-4" />
                          </TextureButton>
                        )}
                        {server.status === "RUNNING" && (
                          <>
                            <TextureButton
                              variant="minimal"
                              size="sm"
                              className="w-fit text-amber-400 hover:text-amber-300"
                              onClick={() => handleAction(server, "stop")}
                              disabled={stop.isPending}
                            >
                              <BsStop className="h-4 w-4" />
                            </TextureButton>
                            <TextureButton
                              variant="minimal"
                              size="sm"
                              className="w-fit"
                              onClick={() => handleAction(server, "restart")}
                              disabled={restart.isPending}
                            >
                              <BsArrowRepeat className="h-4 w-4" />
                            </TextureButton>
                          </>
                        )}
                        <TextureButton
                          variant="minimal"
                          size="sm"
                          className="w-fit"
                          onClick={() => router.push(`/admin/servers/${server.id}/edit`)}
                        >
                          <BsPencil className="h-4 w-4" />
                        </TextureButton>
                        <TextureButton
                          variant="secondary"
                          size="sm"
                          className="w-fit text-red-400 hover:text-red-300"
                          onClick={() => setDeleteConfirmServer(server)}
                        >
                          <BsTrash className="h-4 w-4" />
                        </TextureButton>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </FadeIn>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        open={!!deleteConfirmServer}
        onOpenChange={(open) => !open && setDeleteConfirmServer(null)}
        title="Delete Server"
        description={`Are you sure you want to delete "${deleteConfirmServer?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        isLoading={remove.isPending}
      />
    </FadeIn>
  );
}

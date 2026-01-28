"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@workspace/ui/lib/utils";
import { TextureButton } from "@workspace/ui/components/texture-button";
import { Spinner } from "@workspace/ui/components/spinner";
import { FadeIn } from "@workspace/ui/components/fade-in";
import { ConfirmationModal } from "@workspace/ui/components/confirmation-modal";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@workspace/ui/components/context-menu";
import {
  Edit,
  ExternalLink,
  Play,
  Plus,
  RefreshCw,
  Server as ServerIcon,
  Square,
  Trash,
} from "lucide-react";
import { AdminEmptyState, AdminPageHeader, AdminSearchBar } from "components/AdminPageComponents";
import { useServerMutations, useServers } from "@/hooks/queries";
import type { Server } from "@/lib/api";
import { toast } from "sonner";

export default function AdminServersPage() {
  const router = useRouter();

  // React Query hooks
  const { data: serversList = [], isLoading } = useServers();
  const { remove, start, stop, restart } = useServerMutations();

  // UI state
  const [deleteConfirmServer, setDeleteConfirmServer] = useState<Server | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const handleDelete = async () => {
    if (!deleteConfirmServer) return;
    try {
      await remove.mutateAsync(deleteConfirmServer.id);
      toast.success("Server deleted successfully");
      setDeleteConfirmServer(null);
    } catch {
      toast.error("Failed to delete server");
    }
  };

  const handleAction = async (server: Server, action: "start" | "stop" | "restart") => {
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
    } catch {
      toast.error(`Failed to ${action} server`);
    }
  };

  // Filter servers based on search query
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

  const getStatusStyle = (status: Server["status"]) => {
    // Use neutral zinc colors for all statuses
    return "text-zinc-300 border-zinc-600";
  };

  return (
    <div className={cn("relative min-h-svh bg-[#0b0b0a] transition-colors")}>
      <div className="relative p-8">
        <div className="w-full">
          <FadeIn delay={0}>
            <AdminPageHeader
              title="SERVERS"
              description="Manage all game servers"
              action={{
                label: "Create Server",
                icon: <Plus className="h-4 w-4" />,
                onClick: () => router.push("/admin/servers/new"),
              }}
            />

            <AdminSearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search servers..."
            />
          </FadeIn>

          {/* Server List */}
          <FadeIn delay={0.1}>
            <div className="space-y-3">
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <Spinner className="h-6 w-6" />
                </div>
              ) : filteredServers.length === 0 ? (
                <AdminEmptyState
                  message={
                    searchQuery
                      ? "No servers match your search."
                      : "No servers found. Create your first server."
                  }
                />
              ) : (
                filteredServers.map((server, index) => (
                  <FadeIn key={server.id} delay={0.1 + index * 0.05}>
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div
                          className={cn(
                            "group relative cursor-context-menu rounded-lg border border-zinc-700 bg-zinc-900/50 p-5 transition-all hover:border-zinc-600"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div
                                className={cn(
                                  "rounded border border-zinc-700 bg-zinc-800/50 p-2.5"
                                )}
                              >
                                <ServerIcon className={cn("h-5 w-5 text-zinc-400")} />
                              </div>
                              <div>
                                <div className="flex items-center gap-3">
                                  <h2
                                    className={cn(
                                      "text-sm font-medium tracking-wider text-zinc-100 uppercase"
                                    )}
                                  >
                                    {server.name}
                                  </h2>
                                  <span
                                    className={cn(
                                      "border px-2 py-0.5 text-[10px] font-medium tracking-wider uppercase",
                                      getStatusStyle(server.status)
                                    )}
                                  >
                                    {server.status}
                                  </span>
                                  {server.shortId && (
                                    <span
                                      className={cn(
                                        "border border-zinc-700 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500"
                                      )}
                                    >
                                      {server.shortId}
                                    </span>
                                  )}
                                </div>
                                <div
                                  className={cn(
                                    "mt-1 flex items-center gap-3 text-xs text-zinc-500"
                                  )}
                                >
                                  <span>{server.blueprint?.name || "Unknown"}</span>
                                  <span className={cn("text-zinc-700")}>•</span>
                                  <span>{server.node?.displayName || "Unknown"}</span>
                                  <span className={cn("text-zinc-700")}>•</span>
                                  <span className="font-mono">
                                    {server.memory}MB / {server.cpu}%
                                  </span>
                                  <span className={cn("text-zinc-700")}>•</span>
                                  <span>{server.owner?.name || "Unknown"}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <TextureButton
                                variant="secondary"
                                size="sm"
                                onClick={() => router.push(`/servers/${server.id}`)}
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </TextureButton>
                              {server.status === "STOPPED" && (
                                <TextureButton
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleAction(server, "start")}
                                  disabled={start.isPending}
                                >
                                  <Play className="h-3.5 w-3.5" />
                                </TextureButton>
                              )}
                              {server.status === "RUNNING" && (
                                <>
                                  <TextureButton
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => handleAction(server, "stop")}
                                    disabled={stop.isPending}
                                  >
                                    <Square className="h-3.5 w-3.5" />
                                  </TextureButton>
                                  <TextureButton
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => handleAction(server, "restart")}
                                    disabled={restart.isPending}
                                  >
                                    <RefreshCw className="h-3.5 w-3.5" />
                                  </TextureButton>
                                </>
                              )}
                              <TextureButton
                                variant="secondary"
                                size="sm"
                                onClick={() => router.push(`/admin/servers/${server.id}/edit`)}
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </TextureButton>
                              <TextureButton
                                variant="secondary"
                                size="sm"
                                onClick={() => setDeleteConfirmServer(server)}
                              >
                                <Trash className="h-3.5 w-3.5" />
                              </TextureButton>
                            </div>
                          </div>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent
                        className={cn("min-w-[180px] border-zinc-700 bg-zinc-900")}
                      >
                        <ContextMenuItem
                          onClick={() => router.push(`/servers/${server.id}`)}
                          className="cursor-pointer gap-2"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Open Server
                        </ContextMenuItem>
                        <ContextMenuItem
                          onClick={() => router.push(`/admin/servers/${server.id}/edit`)}
                          className="cursor-pointer gap-2"
                        >
                          <Edit className="h-4 w-4" />
                          Edit Server
                        </ContextMenuItem>
                        <ContextMenuSeparator className={"bg-zinc-700"} />
                        {server.status === "STOPPED" && (
                          <ContextMenuItem
                            onClick={() => handleAction(server, "start")}
                            className="cursor-pointer gap-2"
                          >
                            <Play className="h-4 w-4" />
                            Start Server
                          </ContextMenuItem>
                        )}
                        {server.status === "RUNNING" && (
                          <>
                            <ContextMenuItem
                              onClick={() => handleAction(server, "stop")}
                              className="cursor-pointer gap-2"
                            >
                              <Square className="h-4 w-4" />
                              Stop Server
                            </ContextMenuItem>
                            <ContextMenuItem
                              onClick={() => handleAction(server, "restart")}
                              className="cursor-pointer gap-2"
                            >
                              <RefreshCw className="h-4 w-4" />
                              Restart Server
                            </ContextMenuItem>
                          </>
                        )}
                        <ContextMenuSeparator className={"bg-zinc-700"} />
                        <ContextMenuItem
                          onClick={() => setDeleteConfirmServer(server)}
                          className="cursor-pointer gap-2"
                          variant="destructive"
                        >
                          <Trash className="h-4 w-4" />
                          Delete Server
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  </FadeIn>
                ))
              )}
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
    </div>
  );
}

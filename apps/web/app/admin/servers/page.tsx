"use client";

import {useMemo, useState} from "react";
import {useRouter} from "next/navigation";
import {cn} from "@workspace/ui/lib/utils";
import {TextureButton} from "@workspace/ui/components/texture-button";
import {Spinner} from "@workspace/ui/components/spinner";
import {AnimatedBackground} from "@workspace/ui/components/animated-background";
import {FadeIn} from "@workspace/ui/components/fade-in";
import {FloatingDots} from "@workspace/ui/components/floating-particles";
import {ConfirmationModal} from "@workspace/ui/components/confirmation-modal";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@workspace/ui/components/context-menu";
import {
  EditIcon,
  ExternalLinkIcon,
  PlayIcon,
  PlusIcon,
  RefreshCwIcon,
  ServerIcon,
  SquareIcon,
  TrashIcon
} from "lucide-react";
import {AdminPageHeader, AdminSearchBar, AdminEmptyState} from "components/AdminPageComponents";
import {useServerMutations, useServers} from "@/hooks/queries";
import {CornerAccents, useAdminTheme} from "@/hooks/use-admin-theme";
import type {Server} from "@/lib/api";
import {toast} from "sonner";

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
    } catch (error) {
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
    } catch (error) {
      toast.error(`Failed to ${action} server`);
    }
  };

  // Filter servers based on search query
  const filteredServers = useMemo(() => {
    if (!searchQuery) return serversList;
    const query = searchQuery.toLowerCase();
    return serversList.filter((server) =>
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
    <div className={cn(
      "min-h-svh transition-colors relative bg-[#0b0b0a]",
    )}>
      <AnimatedBackground  />
      <FloatingDots count={15} />

      <div className="relative p-8">
        <div className="max-w-6xl mx-auto">
          <FadeIn delay={0}>
            <AdminPageHeader
              title="SERVERS"
              description="Manage all game servers"
              action={{
                label: "Create Server",
                icon: <PlusIcon className="w-4 h-4" />,
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
                  <Spinner className="w-6 h-6" />
                </div>
              ) : filteredServers.length === 0 ? (
                <AdminEmptyState
                  message={searchQuery ? "No servers match your search." : "No servers found. Create your first server."}
                />
              ) : (
                filteredServers.map((server, index) => (
                  <FadeIn key={server.id} delay={0.1 + index * 0.05}>
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div
                          className={cn(
                            "relative p-5 border transition-all hover:scale-[1.005] group cursor-context-menu bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] border-zinc-200/10 shadow-lg shadow-black/20 hover:border-zinc-700",
                          )}
                        >
                          <CornerAccents size="sm" />

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className={cn(
                                "p-2.5 border border-zinc-700 bg-zinc-800/50",
                              )}>
                                <ServerIcon className={cn("w-5 h-5 text-zinc-400")} />
                              </div>
                              <div>
                                <div className="flex items-center gap-3">
                                  <h2 className={cn(
                                    "text-sm font-medium uppercase tracking-wider text-zinc-100",
                                  )}>
                                    {server.name}
                                  </h2>
                                  <span className={cn(
                                    "text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 border",
                                    getStatusStyle(server.status)
                                  )}>
                                    {server.status}
                                  </span>
                                  {server.shortId && (
                                    <span className={cn(
                                      "text-[10px] font-mono px-1.5 py-0.5 border text-zinc-500 border-zinc-700",
                                    )}>
                                      {server.shortId}
                                    </span>
                                  )}
                                </div>
                                <div className={cn(
                                  "flex items-center gap-3 mt-1 text-xs text-zinc-500",
                                )}>
                                  <span>{server.blueprint?.name || "Unknown"}</span>
                                  <span className={cn("text-zinc-700")}>•</span>
                                  <span>{server.node?.displayName || "Unknown"}</span>
                                  <span className={cn("text-zinc-700")}>•</span>
                                  <span className="font-mono">{server.memory}MB / {server.cpu}%</span>
                                  <span className={cn("text-zinc-700")}>•</span>
                                  <span>{server.owner?.name || "Unknown"}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <TextureButton
                                variant="outline"
                                size="sm"
                                onClick={() => router.push(`/servers/${server.id}`)}
                              >
                                <ExternalLinkIcon className="w-3.5 h-3.5" />
                              </TextureButton>
                              {server.status === "STOPPED" && (
                                <TextureButton
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleAction(server, "start")}
                                  disabled={start.isPending}
                                >
                                  <PlayIcon className="w-3.5 h-3.5" />
                                </TextureButton>
                              )}
                              {server.status === "RUNNING" && (
                                <>
                                  <TextureButton
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleAction(server, "stop")}
                                    disabled={stop.isPending}
                                  >
                                    <SquareIcon className="w-3.5 h-3.5" />
                                  </TextureButton>
                                  <TextureButton
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleAction(server, "restart")}
                                    disabled={restart.isPending}
                                  >
                                    <RefreshCwIcon className="w-3.5 h-3.5" />
                                  </TextureButton>
                                </>
                              )}
                              <TextureButton
                                variant="outline"
                                size="sm"
                                onClick={() => router.push(`/admin/servers/${server.id}/edit`)}
                              >
                                <EditIcon className="w-3.5 h-3.5" />
                              </TextureButton>
                              <TextureButton
                                variant="outline"
                                size="sm"
                                onClick={() => setDeleteConfirmServer(server)}
                              >
                                <TrashIcon className="w-3.5 h-3.5" />
                              </TextureButton>
                            </div>
                          </div>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className={cn(
                        "min-w-[180px] bg-zinc-900 border-zinc-700",
                      )}>
                        <ContextMenuItem
                          onClick={() => router.push(`/servers/${server.id}`)}
                          className="gap-2 cursor-pointer"
                        >
                          <ExternalLinkIcon className="w-4 h-4" />
                          Open Server
                        </ContextMenuItem>
                        <ContextMenuItem
                          onClick={() => router.push(`/admin/servers/${server.id}/edit`)}
                          className="gap-2 cursor-pointer"
                        >
                          <EditIcon className="w-4 h-4" />
                          Edit Server
                        </ContextMenuItem>
                        <ContextMenuSeparator className={"bg-zinc-700"} />
                        {server.status === "STOPPED" && (
                          <ContextMenuItem
                            onClick={() => handleAction(server, "start")}
                            className="gap-2 cursor-pointer"
                          >
                            <PlayIcon className="w-4 h-4" />
                            Start Server
                          </ContextMenuItem>
                        )}
                        {server.status === "RUNNING" && (
                          <>
                            <ContextMenuItem
                              onClick={() => handleAction(server, "stop")}
                              className="gap-2 cursor-pointer"
                            >
                              <SquareIcon className="w-4 h-4" />
                              Stop Server
                            </ContextMenuItem>
                            <ContextMenuItem
                              onClick={() => handleAction(server, "restart")}
                              className="gap-2 cursor-pointer"
                            >
                              <RefreshCwIcon className="w-4 h-4" />
                              Restart Server
                            </ContextMenuItem>
                          </>
                        )}
                        <ContextMenuSeparator className={"bg-zinc-700"} />
                        <ContextMenuItem
                          onClick={() => setDeleteConfirmServer(server)}
                          className="gap-2 cursor-pointer"
                          variant="destructive"
                        >
                          <TrashIcon className="w-4 h-4" />
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
        variant="danger"
        isLoading={remove.isPending}
      />
    </div>
  );
}

"use client";

import {useMemo, useState} from "react";
import {useRouter} from "next/navigation";
import {cn} from "@workspace/ui/lib/utils";
import {Button} from "@workspace/ui/components/button";
import {Spinner} from "@workspace/ui/components/spinner";
import {AnimatedBackground} from "@workspace/ui/components/animated-background";
import {FadeIn} from "@workspace/ui/components/fade-in";
import {FloatingDots} from "@workspace/ui/components/floating-particles";
import {FormModal} from "@workspace/ui/components/form-modal";
import {ConfirmationModal} from "@workspace/ui/components/confirmation-modal";
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,} from "@workspace/ui/components/dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@workspace/ui/components/context-menu";
import {CheckIcon, CopyIcon, CpuIcon, EditIcon, PlusIcon, SettingsIcon, TrashIcon,} from "lucide-react";
import {AdminEmptyState, AdminPageHeader, AdminSearchBar} from "components/AdminPageComponents";
import {useLocations, useNodeMutations, useNodes} from "@/hooks/queries";
import {CornerAccents, useAdminTheme} from "@/hooks/use-admin-theme";
import type {CreateNodeData, Node} from "@/lib/api";
import {toast} from "sonner";
import {TextureButton} from "@workspace/ui/components/texture-button";

export default function NodesPage() {
  const router = useRouter();
  const { mounted, inputClasses, labelClasses, selectClasses } = useAdminTheme();

  // React Query hooks
  const { data: nodesList = [], isLoading } = useNodes();
  const { data: locationsList = [] } = useLocations();
  const { create, remove } = useNodeMutations();

  // UI state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showToken, setShowToken] = useState<{ token: string; token_id: string } | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedTokenId, setCopiedTokenId] = useState(false);
  const [deleteConfirmNode, setDeleteConfirmNode] = useState<Node | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Form state
  const [formData, setFormData] = useState<CreateNodeData>({
    displayName: "",
    host: "",
    port: 3001,
    protocol: "HTTP",
    sftpPort: 2022,
    memoryLimit: 8589934592, // 8GB
    diskLimit: 53687091200, // 50GB
    cpuLimit: 4,
    uploadLimit: 104857600, // 100MB
    locationId: "",
  });

  const resetForm = () => {
    setFormData({
      displayName: "",
      host: "",
      port: 3001,
      protocol: "HTTP",
      sftpPort: 2022,
      memoryLimit: 8589934592,
      diskLimit: 53687091200,
      cpuLimit: 4,
      uploadLimit: 104857600,
      locationId: "",
    });
  };

  const handleSubmit = async () => {
    try {
      const result = await create.mutateAsync(formData);
      setShowToken({ token: result.token, token_id: result.token_id });
      toast.success("Node created successfully");
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      toast.error("Failed to create node");
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmNode) return;
    try {
      await remove.mutateAsync(deleteConfirmNode.id);
      toast.success("Node deleted successfully");
      setDeleteConfirmNode(null);
    } catch (error) {
      toast.error("Failed to delete node");
    }
  };

  const copyToken = () => {
    if (showToken) {
      navigator.clipboard.writeText(showToken.token);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  const copyTokenId = () => {
    if (showToken) {
      navigator.clipboard.writeText(showToken.token_id);
      setCopiedTokenId(true);
      setTimeout(() => setCopiedTokenId(false), 2000);
    }
  };

  const formatBytes = (bytes: number | string) => {
    const numBytes = typeof bytes === "string" ? parseInt(bytes, 10) : bytes;
    const gb = numBytes / 1073741824;
    return gb >= 1 ? `${gb.toFixed(0)} GB` : `${(numBytes / 1048576).toFixed(0)} MB`;
  };

  // Filter nodes based on search query
  const filteredNodes = useMemo(() => {
    if (!searchQuery) return nodesList;
    const query = searchQuery.toLowerCase();
    return nodesList.filter(
      (node) =>
        node.displayName.toLowerCase().includes(query) ||
        node.host.toLowerCase().includes(query) ||
        node.location?.name?.toLowerCase().includes(query)
    );
  }, [nodesList, searchQuery]);

  const isFormValid = formData.displayName.length > 0 && formData.host.length > 0;

  if (!mounted) return null;

  return (
    <div
      className={cn(
        "relative min-h-svh transition-colors bg-[#0b0b0a]",
      )}
    >
      <AnimatedBackground />
      <FloatingDots count={15} />

      <div className="relative p-8">
        <div className="mx-auto max-w-6xl">
          <FadeIn delay={0}>
            <AdminPageHeader
              title="NODES"
              description="Manage daemon nodes"
              action={{
                label: "Add Node",
                icon: <PlusIcon className="h-4 w-4" />,
                onClick: () => {
                  resetForm();
                  setIsModalOpen(true);
                },
              }}
            />

            <AdminSearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search nodes..."
            />
          </FadeIn>

          {/* Nodes List */}
          <FadeIn delay={0.1}>
            <div className="space-y-3">
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <Spinner className="h-6 w-6" />
                </div>
              ) : filteredNodes.length === 0 ? (
                <AdminEmptyState
                  message={searchQuery ? "No nodes match your search." : "No nodes configured. Add your first node to get started."}
                />
              ) : (
                filteredNodes.map((node, index) => (
                  <FadeIn key={node.id} delay={0.1 + index * 0.05}>
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div
                          className={cn(
                            "group relative cursor-context-menu border p-5 transition-all hover:scale-[1.005] border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] shadow-lg shadow-black/20 hover:border-zinc-700",
                          )}
                        >
                          <CornerAccents size="sm" />

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <CpuIcon
                                className={cn(
                                  "h-8 w-8",
                                  node.isOnline
                                    ? "text-zinc-300"
                                    : "text-zinc-600"
                                )}
                              />
                              <div>
                                <div
                                  className={cn(
                                    "flex items-center gap-2 font-medium text-zinc-100",
                                  )}
                                >
                                  {node.displayName}
                                  <span
                                    className={cn(
                                      "border px-1.5 py-0.5 text-[10px] tracking-wider uppercase",
                                      node.isOnline
                                        ? "border-zinc-600 text-zinc-300"
                                        : "border-zinc-700 text-zinc-500"
                                    )}
                                  >
                                    {node.isOnline ? "Online" : "Offline"}
                                  </span>
                                </div>
                                <div
                                  className={cn(
                                    "mt-1 text-xs text-zinc-500",
                                  )}
                                >
                                  {node.protocol.toLowerCase()}://{node.host}:{node.port}
                                </div>
                                <div
                                  className={cn(
                                    "mt-1 flex gap-4 text-xs text-zinc-600",
                                  )}
                                >
                                  <span>CPU: {node.cpuLimit} cores</span>
                                  <span>RAM: {formatBytes(node.memoryLimit)}</span>
                                  <span>Disk: {formatBytes(node.diskLimit)}</span>
                                  {node.heartbeatLatency && (
                                    <span
                                      className={cn("text-zinc-400")}
                                    >
                                      {node.heartbeatLatency}ms
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.push(`/admin/nodes/${node.id}`)}
                                className={cn(
                                  "p-2 text-xs transition-all hover:scale-110 active:scale-95 border-zinc-700 text-zinc-400 hover:text-zinc-100",
                                )}
                              >
                                <SettingsIcon className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.push(`/admin/nodes/${node.id}/edit`)}
                                className={cn(
                                  "p-2 text-xs transition-all hover:scale-110 active:scale-95 border-zinc-700 text-zinc-400 hover:text-zinc-100",
                                )}
                              >
                                <EditIcon className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setDeleteConfirmNode(node)}
                                className={cn(
                                  "p-2 text-xs transition-all hover:scale-110 active:scale-95 border-red-900/50 text-red-400 hover:bg-red-900/20",
                                )}
                              >
                                <TrashIcon className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent
                        className={cn(
                          "min-w-[160px] border-zinc-700 bg-zinc-900",
                        )}
                      >
                        <ContextMenuItem
                          onClick={() => router.push(`/admin/nodes/${node.id}`)}
                          className="cursor-pointer gap-2"
                        >
                          <SettingsIcon className="h-4 w-4" />
                          Configure
                        </ContextMenuItem>
                        <ContextMenuItem
                          onClick={() => router.push(`/admin/nodes/${node.id}/edit`)}
                          className="cursor-pointer gap-2"
                        >
                          <EditIcon className="h-4 w-4" />
                          Edit
                        </ContextMenuItem>
                        <ContextMenuSeparator className={"bg-zinc-700"} />
                        <ContextMenuItem
                          onClick={() => setDeleteConfirmNode(node)}
                          className="cursor-pointer gap-2"
                          variant="destructive"
                        >
                          <TrashIcon className="h-4 w-4" />
                          Delete
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

      {/* Create Modal */}
      <FormModal
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) resetForm();
        }}
        title="Create Node"
        submitLabel="Create"
        onSubmit={handleSubmit}
        isLoading={create.isPending}
        isValid={isFormValid}
      >
        <div className="space-y-4">
          <div>
            <label className={labelClasses}>Display Name</label>
            <input
              type="text"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              placeholder="US West Node 1"
              className={inputClasses}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClasses}>Host</label>
              <input
                type="text"
                value={formData.host}
                onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                placeholder="192.168.1.100"
                className={inputClasses}
                required
              />
            </div>
            <div>
              <label className={labelClasses}>Port</label>
              <input
                type="number"
                value={formData.port}
                onChange={(e) =>
                  setFormData({ ...formData, port: parseInt(e.target.value) || 3001 })
                }
                className={inputClasses}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClasses}>Protocol</label>
              <select
                value={formData.protocol}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    protocol: e.target.value as "HTTP" | "HTTPS" | "HTTPS_PROXY",
                  })
                }
                className={selectClasses}
              >
                <option value="HTTP">HTTP</option>
                <option value="HTTPS">HTTPS</option>
                <option value="HTTPS_PROXY">HTTPS Proxy</option>
              </select>
            </div>
            <div>
              <label className={labelClasses}>Location</label>
              <select
                value={formData.locationId || ""}
                onChange={(e) =>
                  setFormData({ ...formData, locationId: e.target.value || undefined })
                }
                className={selectClasses}
              >
                <option value="">No Location</option>
                {locationsList.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelClasses}>CPU Cores</label>
              <input
                type="number"
                value={formData.cpuLimit}
                onChange={(e) =>
                  setFormData({ ...formData, cpuLimit: parseInt(e.target.value) || 1 })
                }
                className={inputClasses}
                required
              />
            </div>
            <div>
              <label className={labelClasses}>Memory (GB)</label>
              <input
                type="number"
                value={formData.memoryLimit / 1073741824}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    memoryLimit: (parseFloat(e.target.value) || 1) * 1073741824,
                  })
                }
                className={inputClasses}
                required
              />
            </div>
            <div>
              <label className={labelClasses}>Disk (GB)</label>
              <input
                type="number"
                value={formData.diskLimit / 1073741824}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    diskLimit: (parseFloat(e.target.value) || 1) * 1073741824,
                  })
                }
                className={inputClasses}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClasses}>SFTP Port</label>
              <input
                type="number"
                value={formData.sftpPort}
                onChange={(e) =>
                  setFormData({ ...formData, sftpPort: parseInt(e.target.value) || 2022 })
                }
                className={inputClasses}
              />
            </div>
            <div>
              <label className={labelClasses}>Upload Limit (MB)</label>
              <input
                type="number"
                value={(formData.uploadLimit ?? 104857600) / 1048576}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    uploadLimit: (parseFloat(e.target.value) || 100) * 1048576,
                  })
                }
                className={inputClasses}
              />
            </div>
          </div>
        </div>
      </FormModal>

      {/* Token Modal */}
      <Dialog open={!!showToken} onOpenChange={(open) => !open && setShowToken(null)}>
        <DialogContent
          className={cn(
            "sm:max-w-lg border-zinc-700 bg-zinc-900",
          )}
        >
          <DialogHeader>
            <DialogTitle className={cn("text-zinc-100")}>
              Node Credentials
            </DialogTitle>
            <DialogDescription className={cn("text-zinc-400")}>
              Copy these credentials and use them to configure the daemon. They will only be shown
              once.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label
                className={cn(
                  "mb-1 block text-xs tracking-wider uppercase text-zinc-400",
                )}
              >
                Token ID
              </label>
              <div
                className={cn(
                  "flex items-center justify-between gap-2 border p-3 font-mono text-xs break-all border-zinc-700 bg-zinc-950 text-zinc-300",
                )}
              >
                <span className="flex-1">{showToken?.token_id}</span>
                <TextureButton
                  variant="outline"
                  size="sm"
                  onClick={copyTokenId}
                  className={cn("shrink-0 w-fit border-zinc-700")}
                >
                  {copiedTokenId ? (
                    <CheckIcon
                      className={cn("h-4 w-4 text-zinc-300")}
                    />
                  ) : (
                    <CopyIcon className="h-4 w-4" />
                  )}
                </TextureButton>
              </div>
            </div>
            <div>
              <label
                className={cn(
                  "mb-1 block text-xs tracking-wider uppercase text-zinc-400",
                )}
              >
                Token
              </label>
              <div
                className={cn(
                  "flex items-center justify-between gap-2 border p-3 font-mono text-xs break-all border-zinc-700 bg-zinc-950 text-zinc-300",
                )}
              >
                <span className="flex-1">{showToken?.token}</span>
                <TextureButton
                  variant="outline"
                  size="sm"
                  onClick={copyToken}
                  className={cn("shrink-0 w-fit border-zinc-700")}
                >
                  {copiedToken ? (
                    <CheckIcon
                      className={cn("h-4 w-4 text-zinc-300")}
                    />
                  ) : (
                    <CopyIcon className="h-4 w-4" />
                  )}
                </TextureButton>
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <TextureButton
              onClick={() => setShowToken(null)}
              variant="minimal"
            >
              Close
            </TextureButton>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        open={!!deleteConfirmNode}
        onOpenChange={(open) => !open && setDeleteConfirmNode(null)}
        title="Delete Node"
        description={`Are you sure you want to delete "${deleteConfirmNode?.displayName}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        variant="danger"
        isLoading={remove.isPending}
      />
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@stellarUI/lib/utils";
import { TextureButton } from "@stellarUI/components/TextureButton";
import Spinner from "@stellarUI/components/Spinner/Spinner";
import { FadeIn } from "@stellarUI/components/FadeIn/FadeIn";
import FormModal from "@stellarUI/components/FormModal/FormModal";
import ConfirmationModal from "@stellarUI/components/ConfirmationModal/ConfirmationModal";
import { SidebarTrigger } from "@stellarUI/components/Sidebar/Sidebar";
import Input from "@stellarUI/components/Input/Input";
import Label from "@stellarUI/components/Label/Label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@stellarUI/components/Dialog/Dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@stellarUI/components/Select";
import { BsCpu, BsPlus, BsGear, BsPencil, BsTrash, BsCheck, BsClipboard } from "react-icons/bs";
import { useLocations, useNodeMutations, useNodes } from "@/hooks/queries";
import type { CreateNodeData, Node } from "@/lib/api";
import { toast } from "sonner";

export default function NodesPage() {
  const router = useRouter();

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
    port: 8080,
    protocol: "HTTP",
    sftpPort: 2022,
    memoryLimit: 8589934592,
    diskLimit: 53687091200,
    cpuLimit: 4,
    uploadLimit: 104857600,
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

  return (
    <FadeIn className="flex min-h-[calc(100svh-1rem)] w-full flex-col">
      <div className="relative flex min-h-[calc(100svh-1rem)] w-full flex-col transition-colors">
        <div className="relative flex min-h-[calc(100svh-1rem)] w-full flex-col rounded-lg bg-black px-4 pb-4">
          {/* Header */}
          <FadeIn delay={0}>
            <div className="mb-6 flex items-center justify-between">
              <SidebarTrigger className="text-zinc-400 transition-all hover:scale-110 hover:text-zinc-100 active:scale-95" />
              <div className="flex items-center gap-2">
                <TextureButton
                  variant="primary"
                  size="sm"
                  className="w-fit"
                  onClick={() => {
                    resetForm();
                    setIsModalOpen(true);
                  }}
                >
                  <BsPlus className="h-4 w-4" />
                  Add Node
                </TextureButton>
              </div>
            </div>
          </FadeIn>

          {/* Search */}
          <FadeIn delay={0.05}>
            <div className="mb-4">
              <Input
                type="text"
                placeholder="Search nodes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9"
              />
            </div>
          </FadeIn>

          {/* Nodes List */}
          <FadeIn delay={0.1}>
            <div className="flex h-full flex-col rounded-lg border border-white/5 bg-[#090909] p-1 pt-2">
              <div className="flex shrink-0 items-center justify-between pr-2 pb-2 pl-2">
                <div className="flex items-center gap-2 text-xs opacity-50">
                  <BsCpu className="h-3 w-3" />
                  Nodes
                </div>
                <span className="text-xs text-zinc-500">
                  {filteredNodes.length} node{filteredNodes.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex flex-1 flex-col rounded-lg border border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] shadow-lg shadow-black/20">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Spinner />
                  </div>
                ) : filteredNodes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <BsCpu className="mb-4 h-12 w-12 text-zinc-600" />
                    <h3 className="mb-2 text-sm font-medium text-zinc-300">No Nodes</h3>
                    <p className="mb-4 text-xs text-zinc-500">
                      {searchQuery
                        ? "No nodes match your search."
                        : "Add your first node to get started."}
                    </p>
                    {!searchQuery && (
                      <TextureButton
                        variant="minimal"
                        size="sm"
                        className="w-fit"
                        onClick={() => {
                          resetForm();
                          setIsModalOpen(true);
                        }}
                      >
                        <BsPlus className="h-4 w-4" />
                        Add Node
                      </TextureButton>
                    )}
                  </div>
                ) : (
                  filteredNodes.map((node, index) => (
                    <div
                      key={node.id}
                      className={cn(
                        "flex items-center justify-between p-4 transition-colors hover:bg-zinc-800/20",
                        index !== filteredNodes.length - 1 && "border-b border-zinc-800/50"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-lg border",
                            node.isOnline
                              ? "border-green-700/50 bg-green-900/30"
                              : "border-zinc-700 bg-zinc-800/50"
                          )}
                        >
                          <BsCpu
                            className={cn(
                              "h-5 w-5",
                              node.isOnline ? "text-green-400" : "text-zinc-500"
                            )}
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-zinc-100">
                              {node.displayName}
                            </span>
                            <span
                              className={cn(
                                "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase",
                                node.isOnline
                                  ? "bg-green-900/30 text-green-400"
                                  : "bg-zinc-800 text-zinc-500"
                              )}
                            >
                              {node.isOnline ? "Online" : "Offline"}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-zinc-500">
                            {node.protocol.toLowerCase()}://{node.host}:{node.port}
                          </div>
                          <div className="mt-1 flex gap-4 text-xs text-zinc-600">
                            <span>CPU: {node.cpuLimit} cores</span>
                            <span>RAM: {formatBytes(node.memoryLimit)}</span>
                            <span>Disk: {formatBytes(node.diskLimit)}</span>
                            {node.heartbeatLatency && (
                              <span className="text-zinc-400">{node.heartbeatLatency}ms</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <TextureButton
                          variant="minimal"
                          size="sm"
                          className="w-fit"
                          onClick={() => router.push(`/admin/nodes/${node.id}`)}
                        >
                          <BsGear className="h-4 w-4" />
                        </TextureButton>
                        <TextureButton
                          variant="minimal"
                          size="sm"
                          className="w-fit"
                          onClick={() => router.push(`/admin/nodes/${node.id}/edit`)}
                        >
                          <BsPencil className="h-4 w-4" />
                        </TextureButton>
                        <TextureButton
                          variant="secondary"
                          size="sm"
                          className="w-fit text-red-400 hover:text-red-300"
                          onClick={() => setDeleteConfirmNode(node)}
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
            <Label>Display Name</Label>
            <Input
              type="text"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              placeholder="US West Node 1"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Host</Label>
              <Input
                type="text"
                value={formData.host}
                onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                placeholder="192.168.1.100"
                required
              />
            </div>
            <div>
              <Label>Port</Label>
              <Input
                type="number"
                value={formData.port}
                onChange={(e) =>
                  setFormData({ ...formData, port: parseInt(e.target.value) || 3001 })
                }
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Protocol</Label>
              <Select
                value={formData.protocol}
                onValueChange={(value) =>
                  setFormData({ ...formData, protocol: value as "HTTP" | "HTTPS" | "HTTPS_PROXY" })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HTTP">HTTP</SelectItem>
                  <SelectItem value="HTTPS">HTTPS</SelectItem>
                  <SelectItem value="HTTPS_PROXY">HTTPS Proxy</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Location</Label>
              <Select
                value={formData.locationId || "none"}
                onValueChange={(value) =>
                  setFormData({ ...formData, locationId: value === "none" ? undefined : value })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Location</SelectItem>
                  {locationsList.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>CPU Cores</Label>
              <Input
                type="number"
                value={formData.cpuLimit}
                onChange={(e) =>
                  setFormData({ ...formData, cpuLimit: parseInt(e.target.value) || 1 })
                }
                required
              />
            </div>
            <div>
              <Label>Memory (GB)</Label>
              <Input
                type="number"
                value={formData.memoryLimit / 1073741824}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    memoryLimit: (parseFloat(e.target.value) || 1) * 1073741824,
                  })
                }
                required
              />
            </div>
            <div>
              <Label>Disk (GB)</Label>
              <Input
                type="number"
                value={formData.diskLimit / 1073741824}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    diskLimit: (parseFloat(e.target.value) || 1) * 1073741824,
                  })
                }
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>SFTP Port</Label>
              <Input
                type="number"
                value={formData.sftpPort}
                onChange={(e) =>
                  setFormData({ ...formData, sftpPort: parseInt(e.target.value) || 2022 })
                }
              />
            </div>
            <div>
              <Label>Upload Limit (MB)</Label>
              <Input
                type="number"
                value={(formData.uploadLimit ?? 104857600) / 1048576}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    uploadLimit: (parseFloat(e.target.value) || 100) * 1048576,
                  })
                }
              />
            </div>
          </div>
        </div>
      </FormModal>

      {/* Token Modal */}
      <Dialog open={!!showToken} onOpenChange={(open) => !open && setShowToken(null)}>
        <DialogContent className="border-zinc-700 bg-zinc-900 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Node Credentials</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Copy these credentials and use them to configure the daemon. They will only be shown
              once.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Token ID</Label>
              <div className="flex items-center justify-between gap-2 rounded-lg border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs break-all text-zinc-300">
                <span className="flex-1">{showToken?.token_id}</span>
                <TextureButton variant="minimal" size="sm" className="w-fit" onClick={copyTokenId}>
                  {copiedTokenId ? (
                    <BsCheck className="h-4 w-4 text-green-400" />
                  ) : (
                    <BsClipboard className="h-4 w-4" />
                  )}
                </TextureButton>
              </div>
            </div>
            <div>
              <Label>Token</Label>
              <div className="flex items-center justify-between gap-2 rounded-lg border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs break-all text-zinc-300">
                <span className="flex-1">{showToken?.token}</span>
                <TextureButton variant="minimal" size="sm" className="w-fit" onClick={copyToken}>
                  {copiedToken ? (
                    <BsCheck className="h-4 w-4 text-green-400" />
                  ) : (
                    <BsClipboard className="h-4 w-4" />
                  )}
                </TextureButton>
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <TextureButton
              variant="minimal"
              size="sm"
              className="w-fit"
              onClick={() => setShowToken(null)}
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
        isLoading={remove.isPending}
      />
    </FadeIn>
  );
}

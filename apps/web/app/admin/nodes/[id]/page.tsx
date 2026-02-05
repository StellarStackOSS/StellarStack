"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { cn } from "@stellarUI/lib/utils";
import { FadeIn } from "@stellarUI/components/FadeIn/FadeIn";
import { SidebarTrigger } from "@stellarUI/components/Sidebar/Sidebar";
import Spinner from "@stellarUI/components/Spinner/Spinner";
import { TextureButton } from "@stellarUI/components/TextureButton";
import ConfirmationModal from "@stellarUI/components/ConfirmationModal/ConfirmationModal";
import {
  BsCpu,
  BsMemory,
  BsHdd,
  BsClock,
  BsPlus,
  BsTrash,
  BsServer,
  BsArrowLeft,
  BsKey,
  BsSave,
  BsPencil,
} from "react-icons/bs";
import type { Allocation, Node, NodeStats } from "@/lib/api";
import { nodes } from "@/lib/api";
import { toast } from "sonner";
import Label from "@stellarUI/components/Label/Label";
import Input from "@stellarUI/components/Input/Input";
import Select, {
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@stellarUI/components/Select";
import { useNode, useNodeMutations } from "@/hooks/queries";

export default function NodeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const nodeId = params.id as string;

  // React Query hooks
  const { data: node, isLoading, refetch } = useNode(nodeId);
  const { update, regenerateToken, addAllocation, addAllocationRange, deleteAllocation } =
    useNodeMutations();

  // Stats state
  const [stats, setStats] = useState<NodeStats | null>(null);

  // Edit form state
  const [formData, setFormData] = useState({
    displayName: "",
    host: "",
    port: 3001,
    protocol: "HTTP" as "HTTP" | "HTTPS" | "HTTPS_PROXY",
    sftpPort: 2022,
    memoryLimit: 8589934592,
    diskLimit: 53687091200,
    cpuLimit: 4,
    uploadLimit: 104857600,
  });

  // Token state
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [newToken, setNewToken] = useState<{
    token: string;
    token_id: string;
  } | null>(null);

  // Allocation state
  const [showAddAllocation, setShowAddAllocation] = useState(false);
  const [showAddRange, setShowAddRange] = useState(false);
  const [allocationForm, setAllocationForm] = useState({ ip: "", port: 25565, alias: "" });
  const [rangeForm, setRangeForm] = useState({ ip: "", startPort: 25565, endPort: 25575 });
  const [deletingAllocationId, setDeletingAllocationId] = useState<string | null>(null);

  // Initialize form data when node loads
  useEffect(() => {
    if (node) {
      setFormData({
        displayName: node.displayName,
        host: node.host,
        port: node.port,
        protocol: node.protocol,
        sftpPort: node.sftpPort,
        memoryLimit: node.memoryLimit,
        diskLimit: node.diskLimit,
        cpuLimit: node.cpuLimit,
        uploadLimit: node.uploadLimit,
      });
    }
  }, [node]);

  const fetchStats = useCallback(async () => {
    if (!node?.isOnline) return;
    try {
      const data = await nodes.getStats(nodeId);
      setStats(data);
    } catch {
      // Stats fetch failed, node might be offline
    }
  }, [nodeId, node?.isOnline]);

  useEffect(() => {
    if (node?.isOnline) {
      fetchStats();
      const interval = setInterval(fetchStats, 5000);
      return () => clearInterval(interval);
    }
  }, [node?.isOnline, fetchStats]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await update.mutateAsync({
        id: nodeId,
        data: formData,
      });
      toast.success("Node updated successfully");
      refetch();
    } catch (error: any) {
      toast.error(error.message || "Failed to update node");
    }
  };

  const handleRegenerateToken = async () => {
    try {
      const result = await regenerateToken.mutateAsync(nodeId);
      setNewToken(result);
      setShowRegenerateConfirm(false);
      toast.success("Token regenerated successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to regenerate token");
    }
  };

  const handleAddAllocation = async () => {
    try {
      await addAllocation.mutateAsync({
        nodeId,
        data: {
          ip: allocationForm.ip,
          port: allocationForm.port,
          alias: allocationForm.alias || undefined,
        },
      });
      toast.success("Allocation added successfully");
      setShowAddAllocation(false);
      setAllocationForm({ ip: "", port: 25565, alias: "" });
      refetch();
    } catch (error: any) {
      toast.error(error.message || "Failed to add allocation");
    }
  };

  const handleAddRange = async () => {
    if (rangeForm.startPort > rangeForm.endPort) {
      toast.error("Start port must be less than or equal to end port");
      return;
    }
    try {
      const result = await addAllocationRange.mutateAsync({
        nodeId,
        data: rangeForm,
      });
      toast.success(`Added ${result.count} allocations`);
      setShowAddRange(false);
      setRangeForm({ ip: "", startPort: 25565, endPort: 25575 });
      refetch();
    } catch (error: any) {
      toast.error(error.message || "Failed to add allocation range");
    }
  };

  const handleDeleteAllocation = async (allocationId: string) => {
    setDeletingAllocationId(allocationId);
    try {
      await deleteAllocation.mutateAsync({ nodeId, allocationId });
      toast.success("Allocation deleted successfully");
      await refetch();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete allocation");
    } finally {
      setDeletingAllocationId(null);
    }
  };

  const bytesToMiB = (bytes: number) => bytes / (1024 * 1024);
  const miBToBytes = (mib: number) => Math.floor(mib * (1024 * 1024));
  const formatMiB = (mib: number) => `${Math.floor(mib)} MiB`;

  const formatBytes = (bytes: number) => {
    if (bytes >= 1099511627776) return `${(bytes / 1099511627776).toFixed(1)} TB`;
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    return `${bytes} B`;
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  if (isLoading) {
    return (
      <FadeIn className="flex min-h-[calc(100svh-1rem)] w-full flex-col">
        <div className="relative flex min-h-[calc(100svh-1rem)] w-full flex-col transition-colors">
          <div className="relative flex min-h-[calc(100svh-1rem)] w-full flex-col items-center justify-center rounded-lg bg-black px-4 pb-4">
            <Spinner className="h-8 w-8" />
          </div>
        </div>
      </FadeIn>
    );
  }

  if (!node) {
    return (
      <FadeIn className="flex min-h-[calc(100svh-1rem)] w-full flex-col">
        <div className="relative flex min-h-[calc(100svh-1rem)] w-full flex-col transition-colors">
          <div className="relative flex min-h-[calc(100svh-1rem)] w-full flex-col items-center justify-center rounded-lg bg-black px-4 pb-4">
            <p className="text-sm text-zinc-500">Node not found</p>
          </div>
        </div>
      </FadeIn>
    );
  }

  return (
    <FadeIn className="flex min-h-[calc(100svh-1rem)] w-full flex-col">
      <div className="relative flex min-h-[calc(100svh-1rem)] w-full flex-col transition-colors">
        <div className="relative flex min-h-[calc(100svh-1rem)] w-full flex-col rounded-lg bg-black px-4 pb-4">
          {/* Header */}
          <FadeIn delay={0}>
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="text-zinc-400 transition-all hover:scale-110 hover:text-zinc-100 active:scale-95" />
                <TextureButton
                  variant="minimal"
                  size="sm"
                  className="w-fit"
                  onClick={() => router.push("/admin/nodes")}
                >
                  <BsArrowLeft className="h-4 w-4" />
                  Back
                </TextureButton>
              </div>
            </div>
          </FadeIn>

          {/* Node Info Header */}
          {node && (
            <FadeIn delay={0.05}>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-semibold text-zinc-100">{node.displayName}</h1>
                  <span
                    className={cn(
                      "rounded px-2 py-0.5 text-[10px] font-medium tracking-wider uppercase",
                      node.isOnline ? "bg-green-900/50 text-green-400" : "bg-zinc-800 text-zinc-500"
                    )}
                  >
                    {node.isOnline ? "Online" : "Offline"}
                  </span>
                  {node.heartbeatLatency && (
                    <span className="text-xs text-zinc-500">{node.heartbeatLatency}ms</span>
                  )}
                </div>
                <p className="text-sm text-zinc-500">
                  {node.protocol.toLowerCase()}://{node.host}:{node.port}
                </p>
              </div>
            </FadeIn>
          )}

          {/* Stats Grid */}
          {stats && (
            <FadeIn delay={0.1}>
              <div className="mb-4 grid grid-cols-4 gap-4">
                {/* CPU */}
                <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/20 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <BsCpu className="h-4 w-4 text-zinc-400" />
                    <span className="text-xs tracking-wider text-zinc-400 uppercase">CPU</span>
                  </div>
                  <div className="text-2xl font-light text-zinc-100">
                    {stats.cpu.usage_percent.toFixed(1)}%
                  </div>
                  <div className="mt-1 text-xs text-zinc-600">
                    {stats.cpu.cores} cores | Load: {stats.cpu.load_avg.one.toFixed(2)}
                  </div>
                </div>

                {/* Memory */}
                <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/20 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <BsMemory className="h-4 w-4 text-zinc-400" />
                    <span className="text-xs tracking-wider text-zinc-400 uppercase">Memory</span>
                  </div>
                  <div className="text-2xl font-light text-zinc-100">
                    {stats.memory.usage_percent.toFixed(1)}%
                  </div>
                  <div className="mt-1 text-xs text-zinc-600">
                    {formatBytes(stats.memory.used)} / {formatBytes(stats.memory.total)}
                  </div>
                </div>

                {/* Disk */}
                <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/20 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <BsHdd className="h-4 w-4 text-zinc-400" />
                    <span className="text-xs tracking-wider text-zinc-400 uppercase">Disk</span>
                  </div>
                  <div className="text-2xl font-light text-zinc-100">
                    {stats.disk.usage_percent.toFixed(1)}%
                  </div>
                  <div className="mt-1 text-xs text-zinc-600">
                    {formatBytes(stats.disk.used)} / {formatBytes(stats.disk.total)}
                  </div>
                </div>

                {/* Uptime */}
                <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/20 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <BsClock className="h-4 w-4 text-zinc-400" />
                    <span className="text-xs tracking-wider text-zinc-400 uppercase">Uptime</span>
                  </div>
                  <div className="text-2xl font-light text-zinc-100">
                    {formatUptime(stats.uptime)}
                  </div>
                  <div className="mt-1 text-xs text-zinc-600">
                    {stats.os.name} {stats.os.arch}
                  </div>
                </div>
              </div>
            </FadeIn>
          )}

          {/* Configuration Form */}
          {node && (
            <FadeIn delay={0.15}>
              <form onSubmit={handleSubmit}>
                <div className="flex h-full flex-col rounded-lg border border-white/5 bg-[#090909] p-1 pt-2">
                  <div className="flex shrink-0 items-center justify-between pr-2 pb-2 pl-2">
                    <div className="flex items-center gap-2 text-xs opacity-50">
                      <BsPencil className="h-3 w-3" />
                      Node Configuration
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col rounded-lg border border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] p-6 shadow-lg shadow-black/20">
                    <div className="space-y-6">
                      {/* Basic Info */}
                      <div>
                        <Label>Display Name</Label>
                        <Input
                          type="text"
                          value={formData.displayName}
                          onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
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
                            placeholder="daemon.example.com"
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
                            min={1}
                            max={65535}
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
                              setFormData({
                                ...formData,
                                protocol: value as "HTTP" | "HTTPS" | "HTTPS_PROXY",
                              })
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="HTTP">HTTP</SelectItem>
                              <SelectItem value="HTTPS">HTTPS</SelectItem>
                              <SelectItem value="HTTPS_PROXY">HTTPS_PROXY</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>SFTP Port</Label>
                          <Input
                            type="number"
                            value={formData.sftpPort}
                            onChange={(e) =>
                              setFormData({ ...formData, sftpPort: parseInt(e.target.value) || 2022 })
                            }
                            min={1}
                            max={65535}
                            required
                          />
                        </div>
                      </div>

                      {/* Resource Limits */}
                      <div className="border-t border-zinc-700/50 pt-6">
                        <h3 className="mb-4 text-sm font-medium tracking-wider text-zinc-300 uppercase">
                          Resource Limits
                        </h3>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Memory Limit (MiB)</Label>
                            <Input
                              type="number"
                              value={bytesToMiB(formData.memoryLimit)}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  memoryLimit: miBToBytes(parseFloat(e.target.value) || 0),
                                })
                              }
                              min={0}
                              required
                            />
                            <p className="mt-1 text-xs text-zinc-600">
                              {formatMiB(bytesToMiB(formData.memoryLimit))}
                            </p>
                          </div>
                          <div>
                            <Label>Disk Limit (MiB)</Label>
                            <Input
                              type="number"
                              value={bytesToMiB(formData.diskLimit)}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  diskLimit: miBToBytes(parseFloat(e.target.value) || 0),
                                })
                              }
                              min={0}
                              required
                            />
                            <p className="mt-1 text-xs text-zinc-600">
                              {formatMiB(bytesToMiB(formData.diskLimit))}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-4">
                          <div>
                            <Label>CPU Limit (cores)</Label>
                            <Input
                              type="number"
                              value={formData.cpuLimit}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  cpuLimit: parseFloat(e.target.value) || 1,
                                })
                              }
                              min={0.1}
                              step={0.1}
                              required
                            />
                          </div>
                          <div>
                            <Label>Upload Limit (MiB)</Label>
                            <Input
                              type="number"
                              value={bytesToMiB(formData.uploadLimit)}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  uploadLimit: miBToBytes(parseFloat(e.target.value) || 0),
                                })
                              }
                              min={0}
                              required
                            />
                            <p className="mt-1 text-xs text-zinc-600">
                              {formatMiB(bytesToMiB(formData.uploadLimit))}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Token Management */}
                      <div className="border-t border-zinc-700/50 pt-6">
                        <div className="mb-4 flex items-center justify-between">
                          <h3 className="text-sm font-medium tracking-wider text-zinc-300 uppercase">
                            Daemon Token
                          </h3>
                          <TextureButton
                            type="button"
                            variant="minimal"
                            size="sm"
                            className="w-fit"
                            onClick={() => setShowRegenerateConfirm(true)}
                          >
                            <BsKey className="h-3 w-3" />
                            Regenerate
                          </TextureButton>
                        </div>
                        {newToken && (
                          <div className="flex flex-col gap-2 rounded-lg border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs break-all text-zinc-300">
                            <span className="flex-1">TOKENID: {newToken.token_id}</span>
                            <span>TOKEN: {newToken.token}</span>
                          </div>
                        )}
                        {!newToken && (
                          <p className="text-xs text-zinc-500">
                            Token is only shown once when created or regenerated.
                          </p>
                        )}
                      </div>

                      {/* Allocations */}
                      <div className="border-t border-zinc-700/50 pt-6">
                        <div className="mb-4 flex items-center justify-between">
                          <h3 className="text-sm font-medium tracking-wider text-zinc-300 uppercase">
                            Allocations ({node.allocations?.length || 0})
                          </h3>
                          <div className="flex items-center gap-2">
                            <TextureButton
                              type="button"
                              variant="minimal"
                              size="sm"
                              className="w-fit"
                              onClick={() => setShowAddAllocation(true)}
                            >
                              <BsPlus className="h-3 w-3" />
                              Add
                            </TextureButton>
                            <TextureButton
                              type="button"
                              variant="minimal"
                              size="sm"
                              className="w-fit"
                              onClick={() => setShowAddRange(true)}
                            >
                              <BsPlus className="h-3 w-3" />
                              Add Range
                            </TextureButton>
                          </div>
                        </div>

                        {/* Allocations list */}
                        <div className="max-h-64 space-y-2 overflow-y-auto">
                          {!node.allocations || node.allocations.length === 0 ? (
                            <p className="py-4 text-center text-sm text-zinc-500">
                              No allocations configured
                            </p>
                          ) : (
                            node.allocations.map((allocation) => (
                              <div
                                key={allocation.id}
                                className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 p-3"
                              >
                                <div className="flex items-center gap-3">
                                  <BsHdd className="h-4 w-4 text-zinc-500" />
                                  <span className="font-mono text-sm text-zinc-200">
                                    {allocation.ip}:{allocation.port}
                                  </span>
                                  {allocation.assigned && (
                                    <span className="rounded border border-zinc-600 px-2 py-0.5 text-[10px] font-medium tracking-wider text-zinc-400 uppercase">
                                      In Use
                                    </span>
                                  )}
                                  {allocation.alias && (
                                    <span className="text-xs text-zinc-500">
                                      ({allocation.alias})
                                    </span>
                                  )}
                                </div>
                                <TextureButton
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  className="w-fit text-red-400 hover:text-red-300"
                                  disabled={
                                    allocation.assigned || deletingAllocationId === allocation.id
                                  }
                                  onClick={() => handleDeleteAllocation(allocation.id)}
                                  title={
                                    allocation.assigned
                                      ? "Cannot delete assigned allocation"
                                      : "Delete allocation"
                                  }
                                >
                                  {deletingAllocationId === allocation.id ? (
                                    <Spinner className="h-4 w-4" />
                                  ) : (
                                    <BsTrash className="h-4 w-4" />
                                  )}
                                </TextureButton>
                              </div>
                            ))
                          )}
                        </div>

                        {/* Add single allocation form */}
                        {showAddAllocation && (
                          <div className="mt-4 rounded-lg border border-zinc-700 bg-zinc-900/50 p-4">
                            <p className="mb-3 text-sm font-medium text-zinc-300">
                              Add Single Allocation
                            </p>
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <Label>IP Address</Label>
                                <Input
                                  type="text"
                                  value={allocationForm.ip}
                                  onChange={(e) =>
                                    setAllocationForm({ ...allocationForm, ip: e.target.value })
                                  }
                                  placeholder="0.0.0.0"
                                  required
                                />
                              </div>
                              <div>
                                <Label>Port</Label>
                                <Input
                                  type="number"
                                  value={allocationForm.port}
                                  onChange={(e) =>
                                    setAllocationForm({
                                      ...allocationForm,
                                      port: parseInt(e.target.value) || 25565,
                                    })
                                  }
                                  min={1}
                                  max={65535}
                                  required
                                />
                              </div>
                              <div>
                                <Label>Alias (optional)</Label>
                                <Input
                                  type="text"
                                  value={allocationForm.alias}
                                  onChange={(e) =>
                                    setAllocationForm({ ...allocationForm, alias: e.target.value })
                                  }
                                  placeholder="game1"
                                />
                              </div>
                            </div>
                            <div className="mt-3 flex items-center gap-2">
                              <TextureButton
                                type="button"
                                variant="minimal"
                                size="sm"
                                onClick={() => {
                                  setShowAddAllocation(false);
                                  setAllocationForm({ ip: "", port: 25565, alias: "" });
                                }}
                              >
                                Cancel
                              </TextureButton>
                              <TextureButton
                                type="button"
                                variant="primary"
                                size="sm"
                                disabled={!allocationForm.ip || addAllocation.isPending}
                                onClick={handleAddAllocation}
                              >
                                {addAllocation.isPending ? <Spinner className="h-3 w-3" /> : "Add"}
                              </TextureButton>
                            </div>
                          </div>
                        )}

                        {/* Add range form */}
                        {showAddRange && (
                          <div className="mt-4 rounded-lg border border-zinc-700 bg-zinc-900/50 p-4">
                            <p className="mb-3 text-sm font-medium text-zinc-300">
                              Add Allocation Range
                            </p>
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <Label>IP Address</Label>
                                <Input
                                  type="text"
                                  value={rangeForm.ip}
                                  onChange={(e) => setRangeForm({ ...rangeForm, ip: e.target.value })}
                                  placeholder="0.0.0.0"
                                  required
                                />
                              </div>
                              <div>
                                <Label>Start Port</Label>
                                <Input
                                  type="number"
                                  value={rangeForm.startPort}
                                  onChange={(e) =>
                                    setRangeForm({
                                      ...rangeForm,
                                      startPort: parseInt(e.target.value) || 25565,
                                    })
                                  }
                                  min={1}
                                  max={65535}
                                  required
                                />
                              </div>
                              <div>
                                <Label>End Port</Label>
                                <Input
                                  type="number"
                                  value={rangeForm.endPort}
                                  onChange={(e) =>
                                    setRangeForm({
                                      ...rangeForm,
                                      endPort: parseInt(e.target.value) || 25575,
                                    })
                                  }
                                  min={1}
                                  max={65535}
                                  required
                                />
                              </div>
                            </div>
                            <p className="mt-2 text-xs text-zinc-500">
                              This will create{" "}
                              {Math.max(0, rangeForm.endPort - rangeForm.startPort + 1)} allocations
                            </p>
                            <div className="mt-3 flex items-center gap-2">
                              <TextureButton
                                type="button"
                                variant="minimal"
                                size="sm"
                                onClick={() => {
                                  setShowAddRange(false);
                                  setRangeForm({ ip: "", startPort: 25565, endPort: 25575 });
                                }}
                              >
                                Cancel
                              </TextureButton>
                              <TextureButton
                                type="button"
                                variant="primary"
                                size="sm"
                                disabled={!rangeForm.ip || addAllocationRange.isPending}
                                onClick={handleAddRange}
                              >
                                {addAllocationRange.isPending ? (
                                  <Spinner className="h-3 w-3" />
                                ) : (
                                  "Add Range"
                                )}
                              </TextureButton>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="mt-6 flex justify-end gap-3">
                  <TextureButton
                    type="button"
                    variant="minimal"
                    size="sm"
                    onClick={() => router.push("/admin/nodes")}
                  >
                    Cancel
                  </TextureButton>
                  <TextureButton
                    variant="primary"
                    size="sm"
                    type="submit"
                    disabled={update.isPending}
                  >
                    {update.isPending ? (
                      <Spinner className="h-4 w-4" />
                    ) : (
                      <BsSave className="h-4 w-4" />
                    )}
                    {update.isPending ? "Saving..." : "Save Changes"}
                  </TextureButton>
                </div>
              </form>
            </FadeIn>
          )}

          {/* Servers Section */}
          {node && node.servers && node.servers.length > 0 && (
            <FadeIn delay={0.2}>
              <div className="mt-4 flex h-full flex-col rounded-lg border border-white/5 bg-[#090909] p-1 pt-2">
                <div className="flex shrink-0 items-center justify-between pr-2 pb-2 pl-2">
                  <div className="flex items-center gap-2 text-xs opacity-50">
                    <BsServer className="h-3 w-3" />
                    Servers on this Node
                  </div>
                  <span className="text-xs text-zinc-500">{node.servers.length} servers</span>
                </div>
                <div className="flex flex-1 flex-col rounded-lg border border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] p-4 shadow-lg shadow-black/20">
                  <div className="grid grid-cols-3 gap-4">
                    {node.servers.map((server) => (
                      <div
                        key={server.id}
                        className="rounded-lg border border-zinc-700/50 bg-zinc-800/20 p-4"
                      >
                        <div className="flex items-center gap-2">
                          <BsServer className="h-4 w-4 text-zinc-400" />
                          <span className="font-medium text-zinc-100">{server.name}</span>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <span
                            className={cn(
                              "rounded px-2 py-0.5 text-[10px] font-medium tracking-wider uppercase",
                              server.status === "RUNNING"
                                ? "bg-green-900/50 text-green-400"
                                : "bg-zinc-800 text-zinc-500"
                            )}
                          >
                            {server.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </FadeIn>
          )}
        </div>
      </div>

      {/* Regenerate Token Confirmation */}
      <ConfirmationModal
        open={showRegenerateConfirm}
        onOpenChange={setShowRegenerateConfirm}
        onConfirm={handleRegenerateToken}
        title="Regenerate Token"
        description="This will invalidate the current daemon token. The daemon will need to be reconfigured with the new token. This action cannot be undone."
        confirmLabel={regenerateToken.isPending ? "Regenerating..." : "Regenerate"}
        isLoading={regenerateToken.isPending}
      />
    </FadeIn>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { cn } from "@workspace/ui/lib/utils";
import { FadeIn } from "@workspace/ui/components/fade-in";
import { SidebarTrigger } from "@workspace/ui/components/sidebar";
import { Spinner } from "@workspace/ui/components/spinner";
import { TextureButton } from "@workspace/ui/components/texture-button";
import {
  BsCpu,
  BsMemory,
  BsHdd,
  BsClock,
  BsPlus,
  BsTrash,
  BsServer,
  BsArrowLeft,
} from "react-icons/bs";
import type { Allocation, Node, NodeStats } from "@/lib/api";
import { nodes } from "@/lib/api";
import { toast } from "sonner";
import { Label } from "@workspace/ui/components/label";
import { Input } from "@workspace/ui/components/input";

export default function NodeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [node, setNode] = useState<Node | null>(null);
  const [stats, setStats] = useState<NodeStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingAllocation, setIsAddingAllocation] = useState(false);
  const [allocationForm, setAllocationForm] = useState({
    ip: "",
    startPort: 25565,
    endPort: 25565,
    isRange: false,
  });

  const fetchNode = useCallback(async () => {
    try {
      const data = await nodes.get(params.id as string);
      setNode(data);
    } catch {
      toast.error("Failed to fetch node");
    } finally {
      setIsLoading(false);
    }
  }, [params.id]);

  const fetchStats = useCallback(async () => {
    if (!node?.isOnline) return;
    try {
      const data = await nodes.getStats(params.id as string);
      setStats(data);
    } catch {
      // Stats fetch failed, node might be offline
    }
  }, [params.id, node?.isOnline]);

  useEffect(() => {
    fetchNode();
  }, [fetchNode]);

  useEffect(() => {
    if (node?.isOnline) {
      fetchStats();
      const interval = setInterval(fetchStats, 5000);
      return () => clearInterval(interval);
    }
  }, [node?.isOnline, fetchStats]);

  const handleAddAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!node) return;

    try {
      if (allocationForm.isRange) {
        const result = await nodes.addAllocationRange(node.id, {
          ip: allocationForm.ip,
          startPort: allocationForm.startPort,
          endPort: allocationForm.endPort,
        });
        toast.success(`Created ${result.count} allocations`);
      } else {
        await nodes.addAllocation(node.id, {
          ip: allocationForm.ip,
          port: allocationForm.startPort,
        });
        toast.success("Allocation added");
      }
      setIsAddingAllocation(false);
      setAllocationForm({ ip: "", startPort: 25565, endPort: 25565, isRange: false });
      fetchNode();
    } catch {
      toast.error("Failed to add allocation");
    }
  };

  const handleDeleteAllocation = async (allocation: Allocation) => {
    if (!node) return;
    if (allocation.assigned) {
      toast.error("Cannot delete assigned allocation");
      return;
    }
    if (!confirm(`Delete allocation ${allocation.ip}:${allocation.port}?`)) return;

    try {
      await nodes.deleteAllocation(node.id, allocation.id);
      toast.success("Allocation deleted");
      fetchNode();
    } catch {
      toast.error("Failed to delete allocation");
    }
  };

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

          {/* Allocations Section */}
          <FadeIn delay={0.15}>
            <div className="flex h-full flex-col rounded-lg border border-white/5 bg-[#090909] p-1 pt-2">
              <div className="flex shrink-0 items-center justify-between pr-2 pb-2 pl-2">
                <div className="flex items-center gap-2 text-xs opacity-50">
                  <BsServer className="h-3 w-3" />
                  Allocations
                </div>
                <TextureButton
                  variant="minimal"
                  size="sm"
                  className="w-fit"
                  onClick={() => setIsAddingAllocation(true)}
                >
                  <BsPlus className="h-4 w-4" />
                  Add
                </TextureButton>
              </div>
              <div className="flex flex-1 flex-col rounded-lg border border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] shadow-lg shadow-black/20">
                {/* Add Allocation Form */}
                {isAddingAllocation && (
                  <form onSubmit={handleAddAllocation} className="border-b border-zinc-800/50 p-4">
                    <div className="grid grid-cols-4 gap-4">
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
                        <Label>{allocationForm.isRange ? "Start Port" : "Port"}</Label>
                        <Input
                          type="number"
                          value={allocationForm.startPort}
                          onChange={(e) =>
                            setAllocationForm({
                              ...allocationForm,
                              startPort: parseInt(e.target.value),
                            })
                          }
                          required
                        />
                      </div>
                      {allocationForm.isRange && (
                        <div>
                          <Label>End Port</Label>
                          <Input
                            type="number"
                            value={allocationForm.endPort}
                            onChange={(e) =>
                              setAllocationForm({
                                ...allocationForm,
                                endPort: parseInt(e.target.value),
                              })
                            }
                            required
                          />
                        </div>
                      )}
                      <div className="flex items-end gap-2">
                        <label className="flex items-center gap-2">
                          <Input
                            type="checkbox"
                            checked={allocationForm.isRange}
                            onChange={(e) =>
                              setAllocationForm({ ...allocationForm, isRange: e.target.checked })
                            }
                            className="h-4 w-4"
                          />
                          <span className="text-xs text-zinc-400">Range</span>
                        </label>
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                      <TextureButton
                        variant="minimal"
                        size="sm"
                        type="button"
                        onClick={() => setIsAddingAllocation(false)}
                      >
                        Cancel
                      </TextureButton>
                      <TextureButton variant="primary" size="sm" type="submit">
                        Add
                      </TextureButton>
                    </div>
                  </form>
                )}

                {/* Allocations Table */}
                <div className="overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-zinc-800/50 text-xs tracking-wider text-zinc-500 uppercase">
                        <th className="p-3 text-left font-medium">IP:Port</th>
                        <th className="p-3 text-left font-medium">Alias</th>
                        <th className="p-3 text-left font-medium">Status</th>
                        <th className="p-3 text-left font-medium">Server</th>
                        <th className="p-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!node.allocations || node.allocations.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-sm text-zinc-500">
                            No allocations. Add some to assign to servers.
                          </td>
                        </tr>
                      ) : (
                        node.allocations.map((allocation) => (
                          <tr
                            key={allocation.id}
                            className="border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/20"
                          >
                            <td className="p-3 font-mono text-sm text-zinc-100">
                              {allocation.ip}:{allocation.port}
                            </td>
                            <td className="p-3 text-sm text-zinc-400">{allocation.alias || "-"}</td>
                            <td className="p-3">
                              <span
                                className={cn(
                                  "rounded px-2 py-0.5 text-[10px] font-medium tracking-wider uppercase",
                                  allocation.assigned
                                    ? "bg-blue-900/50 text-blue-400"
                                    : "bg-zinc-800 text-zinc-500"
                                )}
                              >
                                {allocation.assigned ? "Assigned" : "Available"}
                              </span>
                            </td>
                            <td className="p-3 text-sm text-zinc-400">
                              {allocation.serverId || "-"}
                            </td>
                            <td className="p-3 text-right">
                              <TextureButton
                                variant="secondary"
                                size="sm"
                                className="w-fit text-red-400 hover:text-red-300"
                                onClick={() => handleDeleteAllocation(allocation)}
                                disabled={allocation.assigned}
                              >
                                <BsTrash className="h-3 w-3" />
                              </TextureButton>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </FadeIn>

          {/* Servers Section */}
          {node.servers && node.servers.length > 0 && (
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
    </FadeIn>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { cn } from "@workspace/ui/lib/utils";
import { TextureButton } from "@workspace/ui/components/texture-button";
import {
  Activity,
  ArrowLeft,
  Cpu,
  HardDrive,
  MemoryStick,
  Plus,
  Server,
  Trash,
} from "lucide-react";
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
      <div className={cn("flex min-h-svh items-center justify-center bg-[#0b0b0a] p-6")}>
        <div className={cn("text-sm text-zinc-500")}>Loading...</div>
      </div>
    );
  }

  if (!node) {
    return (
      <div className={cn("flex min-h-svh items-center justify-center bg-[#0b0b0a] p-6")}>
        <div className={cn("text-sm text-zinc-500")}>Node not found</div>
      </div>
    );
  }

  return (
    <div className={cn("min-h-svh bg-[#0b0b0a] p-6")}>
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <TextureButton variant="minimal" onClick={() => router.push("/admin/nodes")}>
          <ArrowLeft className="h-4 w-4" />
        </TextureButton>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className={cn("text-2xl font-light tracking-wider text-zinc-100")}>
              {node.displayName}
            </h1>
            <span
              className={cn(
                "px-2 py-0.5 text-[10px] tracking-wider uppercase",
                node.isOnline ? "bg-green-900/50 text-green-400" : "bg-zinc-800 text-zinc-500"
              )}
            >
              {node.isOnline ? "Online" : "Offline"}
            </span>
            {node.heartbeatLatency && (
              <span className={cn("text-xs text-zinc-500")}>{node.heartbeatLatency}ms</span>
            )}
          </div>
          <p className={cn("mt-1 text-sm text-zinc-500")}>
            {node.protocol.toLowerCase()}://{node.host}:{node.port}
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="mb-6 grid grid-cols-4 gap-4">
          {/* CPU */}
          <div className={cn("border border-zinc-700/50 bg-zinc-900/50 p-4")}>
            <div className="mb-2 flex items-center gap-2">
              <Cpu className={cn("h-4 w-4 text-zinc-400")} />
              <span className={cn("text-xs tracking-wider text-zinc-400 uppercase")}>CPU</span>
            </div>
            <div className={cn("text-2xl font-light text-zinc-100")}>
              {stats.cpu.usage_percent.toFixed(1)}%
            </div>
            <div className={cn("mt-1 text-xs text-zinc-600")}>
              {stats.cpu.cores} cores | Load: {stats.cpu.load_avg.one.toFixed(2)}
            </div>
          </div>

          {/* Memory */}
          <div className={cn("border border-zinc-700/50 bg-zinc-900/50 p-4")}>
            <div className="mb-2 flex items-center gap-2">
              <MemoryStick className={cn("h-4 w-4 text-zinc-400")} />
              <span className={cn("text-xs tracking-wider text-zinc-400 uppercase")}>Memory</span>
            </div>
            <div className={cn("text-2xl font-light text-zinc-100")}>
              {stats.memory.usage_percent.toFixed(1)}%
            </div>
            <div className={cn("mt-1 text-xs text-zinc-600")}>
              {formatBytes(stats.memory.used)} / {formatBytes(stats.memory.total)}
            </div>
          </div>

          {/* Disk */}
          <div className={cn("border border-zinc-700/50 bg-zinc-900/50 p-4")}>
            <div className="mb-2 flex items-center gap-2">
              <HardDrive className={cn("h-4 w-4 text-zinc-400")} />
              <span className={cn("text-xs tracking-wider text-zinc-400 uppercase")}>Disk</span>
            </div>
            <div className={cn("text-2xl font-light text-zinc-100")}>
              {stats.disk.usage_percent.toFixed(1)}%
            </div>
            <div className={cn("mt-1 text-xs text-zinc-600")}>
              {formatBytes(stats.disk.used)} / {formatBytes(stats.disk.total)}
            </div>
          </div>

          {/* System Info */}
          <div className={cn("border border-zinc-700/50 bg-zinc-900/50 p-4")}>
            <div className="mb-2 flex items-center gap-2">
              <Activity className={cn("h-4 w-4 text-zinc-400")} />
              <span className={cn("text-xs tracking-wider text-zinc-400 uppercase")}>Uptime</span>
            </div>
            <div className={cn("text-2xl font-light text-zinc-100")}>
              {formatUptime(stats.uptime)}
            </div>
            <div className={cn("mt-1 text-xs text-zinc-600")}>
              {stats.os.name} {stats.os.arch}
            </div>
          </div>
        </div>
      )}

      {/* Allocations Section */}
      <div className="mb-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className={cn("text-lg font-light tracking-wider text-zinc-100")}>Allocations</h2>
          <TextureButton onClick={() => setIsAddingAllocation(true)}>
            <Plus className="mr-1 h-3 w-3" />
            Add
          </TextureButton>
        </div>

        {isAddingAllocation && (
          <form
            onSubmit={handleAddAllocation}
            className={cn("mb-4 border border-zinc-700/50 bg-zinc-900/50 p-4")}
          >
            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label>IP Address</Label>
                <Input
                  type="text"
                  value={allocationForm.ip}
                  onChange={(e) => setAllocationForm({ ...allocationForm, ip: e.target.value })}
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
                    setAllocationForm({ ...allocationForm, startPort: parseInt(e.target.value) })
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
                      setAllocationForm({ ...allocationForm, endPort: parseInt(e.target.value) })
                    }
                    required
                  />
                </div>
              )}
              <div className="flex items-end gap-2">
                <Label>
                  <Input
                    type="checkbox"
                    checked={allocationForm.isRange}
                    onChange={(e) =>
                      setAllocationForm({ ...allocationForm, isRange: e.target.checked })
                    }
                    className="rounded"
                  />
                  <span className={cn("text-xs text-zinc-400")}>Range</span>
                </Label>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <TextureButton variant="minimal" onClick={() => setIsAddingAllocation(false)}>
                Cancel
              </TextureButton>
              <TextureButton variant="minimal" type="submit">
                Add
              </TextureButton>
            </div>
          </form>
        )}

        <div className={cn("overflow-hidden border border-zinc-700/50")}>
          <table className="w-full">
            <thead>
              <tr className={cn("bg-zinc-900/50 text-xs tracking-wider text-zinc-400 uppercase")}>
                <th className="p-3 text-left">IP:Port</th>
                <th className="p-3 text-left">Alias</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Server</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!node.allocations || node.allocations.length === 0 ? (
                <tr>
                  <td colSpan={5} className={cn("py-8 text-center text-sm text-zinc-500")}>
                    No allocations. Add some to assign to servers.
                  </td>
                </tr>
              ) : (
                node.allocations.map((allocation) => (
                  <tr
                    key={allocation.id}
                    className={cn(
                      "border-t border-zinc-700/50 transition-colors hover:bg-zinc-900/30"
                    )}
                  >
                    <td className={cn("p-3 font-mono text-sm text-zinc-100")}>
                      {allocation.ip}:{allocation.port}
                    </td>
                    <td className={cn("p-3 text-sm text-zinc-400")}>{allocation.alias || "-"}</td>
                    <td className="p-3">
                      <span
                        className={cn(
                          "px-2 py-0.5 text-[10px] tracking-wider uppercase",
                          allocation.assigned
                            ? "bg-blue-900/50 text-blue-400"
                            : "bg-zinc-800 text-zinc-500"
                        )}
                      >
                        {allocation.assigned ? "Assigned" : "Available"}
                      </span>
                    </td>
                    <td className={cn("p-3 text-sm text-zinc-400")}>
                      {allocation.serverId || "-"}
                    </td>
                    <td className="p-3 text-right">
                      <TextureButton
                        variant="destructive"
                        onClick={() => handleDeleteAllocation(allocation)}
                        disabled={allocation.assigned}
                      >
                        <Trash className="h-3 w-3" />
                      </TextureButton>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Servers Section */}
      {node.servers && node.servers.length > 0 && (
        <div>
          <h2 className={cn("mb-4 text-lg font-light tracking-wider text-zinc-100")}>
            Servers on this Node
          </h2>
          <div className="grid grid-cols-3 gap-4">
            {node.servers.map((server) => (
              <div key={server.id} className={cn("border border-zinc-700/50 bg-zinc-900/50 p-4")}>
                <div className="flex items-center gap-2">
                  <Server className={cn("h-4 w-4 text-zinc-400")} />
                  <span className={cn("font-medium text-zinc-100")}>{server.name}</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className={cn(
                      "px-2 py-0.5 text-[10px] tracking-wider uppercase",
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
      )}
    </div>
  );
}

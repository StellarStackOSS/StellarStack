"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { cn } from "@stellarUI/lib/utils";
import { FadeIn } from "@stellarUI/components/FadeIn/FadeIn";
import { SidebarTrigger } from "@stellarUI/components/Sidebar/Sidebar";
import Spinner from "@stellarUI/components/Spinner/Spinner";
import { TextureButton } from "@stellarUI/components/TextureButton";
import ConfirmationModal from "@stellarUI/components/ConfirmationModal/ConfirmationModal";
import {
  BsArrowLeft,
  BsBoxArrowRight,
  BsHdd,
  BsPlus,
  BsArrowRepeat,
  BsSave,
  BsSliders,
  BsTrash,
  BsPencil,
} from "react-icons/bs";
import { useServer, useServerMutations } from "@/hooks/queries";
import GetErrorMessage from "@/lib/error-utils";
import Label from "@stellarUI/components/Label/Label";
import Input from "@stellarUI/components/Input/Input";
import Textarea from "@stellarUI/components/Textarea";
import Select, {
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@stellarUI/components/Select";
import { toast } from "sonner";
import type { Node } from "@/lib/api";
import { Allocation, Blueprint, blueprints, nodes, servers } from "@/lib/api";

export default function EditServerPage() {
  const router = useRouter();
  const params = useParams();
  const serverId = params.id as string;

  // React Query hooks
  const { data: server, isLoading, refetch } = useServer(serverId);
  const { update, reinstall, setStatus } = useServerMutations();

  // Modal state
  const [reinstallModalOpen, setReinstallModalOpen] = useState(false);
  const [isReinstalling, setIsReinstalling] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>("");

  // Allocation state
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [availableAllocations, setAvailableAllocations] = useState<Allocation[]>([]);
  const [isLoadingAllocations, setIsLoadingAllocations] = useState(false);
  const [showAddAllocation, setShowAddAllocation] = useState(false);
  const [selectedAllocationId, setSelectedAllocationId] = useState<string>("");
  const [isAddingAllocation, setIsAddingAllocation] = useState(false);
  const [removingAllocationId, setRemovingAllocationId] = useState<string | null>(null);

  // Blueprint state
  const [blueprintList, setBlueprintList] = useState<Blueprint[]>([]);
  const [isLoadingBlueprints, setIsLoadingBlueprints] = useState(false);
  const [selectedBlueprintId, setSelectedBlueprintId] = useState<string>("");
  const [showBlueprintModal, setShowBlueprintModal] = useState(false);
  const [reinstallOnBlueprintChange, setReinstallOnBlueprintChange] = useState(false);
  const [isChangingBlueprint, setIsChangingBlueprint] = useState(false);

  // Transfer state
  const [nodesList, setNodesList] = useState<Node[]>([]);
  const [isLoadingNodes, setIsLoadingNodes] = useState(false);
  const [selectedTargetNodeId, setSelectedTargetNodeId] = useState<string>("");
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferStatus, setTransferStatus] = useState<any>(null);
  const [showTransferHistory, setShowTransferHistory] = useState(false);

  // Track if form has been initialized to prevent polling from overwriting user edits
  const [formInitialized, setFormInitialized] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    memory: "1024",
    disk: "10240",
    cpu: "100",
    cpuPinning: "",
    swap: "-1",
    oomKillDisable: false,
    backupLimit: "3",
  });

  // Initialize form data and status when server data loads (only once)
  useEffect(() => {
    if (server && !formInitialized) {
      setSelectedStatus(server.status);
      setSelectedBlueprintId(server.blueprintId || "");
      setFormData({
        name: server.name,
        description: server.description || "",
        memory: String(server.memory),
        disk: String(server.disk),
        cpu: String(server.cpu),
        cpuPinning: server.cpuPinning || "",
        swap: String(server.swap),
        oomKillDisable: server.oomKillDisable,
        backupLimit: String(server.backupLimit),
      });
      if (server.allocations) {
        setAllocations(server.allocations);
      }
      setFormInitialized(true);
    }
  }, [server, formInitialized]);

  // Load blueprints
  useEffect(() => {
    const loadBlueprints = async () => {
      setIsLoadingBlueprints(true);
      try {
        const list = await blueprints.list();
        setBlueprintList(list);
      } catch (error: unknown) {
        toast.error(GetErrorMessage(error, "Failed to load blueprints"));
      } finally {
        setIsLoadingBlueprints(false);
      }
    };
    loadBlueprints();
  }, []);

  // Load nodes for transfer
  useEffect(() => {
    const loadNodes = async () => {
      setIsLoadingNodes(true);
      try {
        const list = await nodes.list();
        setNodesList(list);
      } catch (error: unknown) {
        toast.error(GetErrorMessage(error, "Failed to load nodes"));
      } finally {
        setIsLoadingNodes(false);
      }
    };
    loadNodes();
  }, []);

  // Load allocations
  const loadAllocations = async () => {
    if (!serverId) return;
    setIsLoadingAllocations(true);
    try {
      const allocs = await servers.allocations.list(serverId);
      setAllocations(allocs);
    } catch (error: unknown) {
      toast.error(GetErrorMessage(error, "Failed to load allocations"));
    } finally {
      setIsLoadingAllocations(false);
    }
  };

  // Load available allocations when showing add dialog
  const loadAvailableAllocations = async () => {
    if (!serverId) return;
    try {
      const available = await servers.allocations.available(serverId);
      setAvailableAllocations(available);
    } catch (error: unknown) {
      toast.error(GetErrorMessage(error, "Failed to load available allocations"));
    }
  };

  // Add allocation to server
  const handleAddAllocation = async () => {
    if (!serverId || !selectedAllocationId) return;
    setIsAddingAllocation(true);
    try {
      await servers.allocations.add(serverId, selectedAllocationId);
      toast.success("Allocation added successfully");
      setShowAddAllocation(false);
      setSelectedAllocationId("");
      loadAllocations();
    } catch (error: unknown) {
      toast.error(GetErrorMessage(error, "Failed to add allocation"));
    } finally {
      setIsAddingAllocation(false);
    }
  };

  // Remove allocation from server
  const handleRemoveAllocation = async (allocationId: string) => {
    if (!serverId) return;
    setRemovingAllocationId(allocationId);
    try {
      await servers.allocations.remove(serverId, allocationId);
      toast.success("Allocation removed successfully");
      loadAllocations();
    } catch (error: unknown) {
      toast.error(GetErrorMessage(error, "Failed to remove allocation"));
    } finally {
      setRemovingAllocationId(null);
    }
  };

  // Transfer handlers
  const handleStartTransfer = async () => {
    if (!serverId || !selectedTargetNodeId) return;
    setIsTransferring(true);
    try {
      await servers.transfer.start(serverId, selectedTargetNodeId);
      toast.success("Transfer initiated successfully");
      setShowTransferModal(false);
      setSelectedTargetNodeId("");
      fetchTransferStatus();
    } catch (error: unknown) {
      toast.error(GetErrorMessage(error, "Failed to initiate transfer"));
    } finally {
      setIsTransferring(false);
    }
  };

  const fetchTransferStatus = async () => {
    if (!serverId) return;
    try {
      const status = await servers.transfer.get(serverId);
      setTransferStatus(status);
    } catch (error: unknown) {
      console.error("Failed to fetch transfer status", error);
    }
  };

  const handleCancelTransfer = async () => {
    if (!serverId) return;
    try {
      await servers.transfer.cancel(serverId);
      toast.success("Transfer cancelled");
      setTransferStatus(null);
    } catch (error: unknown) {
      toast.error(GetErrorMessage(error, "Failed to cancel transfer"));
    }
  };

  // Load transfer status when component mounts or modal opens
  useEffect(() => {
    if (showTransferModal && serverId) {
      fetchTransferStatus();
      const interval = setInterval(fetchTransferStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [showTransferModal, serverId]);

  const handleReinstall = async () => {
    setIsReinstalling(true);
    try {
      await reinstall.mutateAsync(serverId);
      toast.success("Server reinstall initiated");
      setReinstallModalOpen(false);
      refetch();
    } catch (error: unknown) {
      toast.error(GetErrorMessage(error, "Failed to reinstall server"));
    } finally {
      setIsReinstalling(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      await setStatus.mutateAsync({ id: serverId, status: newStatus });
      toast.success(`Server status set to ${newStatus}`);
      setSelectedStatus(newStatus);
      refetch();
    } catch (error: unknown) {
      toast.error(GetErrorMessage(error, "Failed to update server status"));
    }
  };

  const handleChangeBlueprint = async () => {
    if (!serverId || !selectedBlueprintId) return;
    setIsChangingBlueprint(true);
    try {
      await servers.changeBlueprint(serverId, {
        blueprintId: selectedBlueprintId,
        reinstall: reinstallOnBlueprintChange,
      });
      toast.success("Server blueprint changed successfully");
      setShowBlueprintModal(false);
      setReinstallOnBlueprintChange(false);
      refetch();
    } catch (error: unknown) {
      toast.error(GetErrorMessage(error, "Failed to change server blueprint"));
    } finally {
      setIsChangingBlueprint(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await update.mutateAsync({
        id: serverId,
        data: {
          name: formData.name,
          description: formData.description || undefined,
          memory: parseInt(formData.memory) || 1024,
          disk: parseInt(formData.disk) || 10240,
          cpu: parseInt(formData.cpu) || 100,
          cpuPinning: formData.cpuPinning || undefined,
          swap: parseInt(formData.swap) ?? -1,
          oomKillDisable: formData.oomKillDisable,
          backupLimit: parseInt(formData.backupLimit) || 0,
        },
      });
      toast.success("Server updated successfully");
      router.push("/admin/servers");
    } catch (error: unknown) {
      toast.error(GetErrorMessage(error, "Failed to update server"));
    }
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
                  onClick={() => router.push("/admin/servers")}
                >
                  <BsArrowLeft className="h-4 w-4" />
                  Back
                </TextureButton>
              </div>
            </div>
          </FadeIn>

          {/* Page Title */}
          <FadeIn delay={0.05}>
            <div className="mb-4">
              <h1 className="text-xl font-semibold text-zinc-100">Edit Server</h1>
              <p className="text-sm text-zinc-500">
                {server?.name} ({server?.shortId})
              </p>
            </div>
          </FadeIn>

          {/* Form Content */}
          <FadeIn delay={0.1}>
            <form onSubmit={handleSubmit}>
              <div className="flex h-full flex-col rounded-lg border border-white/5 bg-[#090909] p-1 pt-2">
                <div className="flex shrink-0 items-center justify-between pr-2 pb-2 pl-2">
                  <div className="flex items-center gap-2 text-xs opacity-50">
                    <BsPencil className="h-3 w-3" />
                    Server Configuration
                  </div>
                </div>
                <div className="flex flex-1 flex-col rounded-lg border border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] p-6 shadow-lg shadow-black/20">
                  <div className="space-y-6">
                    {/* Basic Info */}
                    <div>
                      <Label>Name</Label>
                      <Input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>

                    <div>
                      <Label>Description</Label>
                      <Textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Optional description..."
                        rows={3}
                      />
                    </div>

                    {/* Resources */}
                    <div className="border-t border-zinc-700/50 pt-6">
                      <h3 className="mb-4 text-sm font-medium tracking-wider text-zinc-300 uppercase">
                        Resources
                      </h3>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label>CPU (%)</Label>
                          <Input
                            type="number"
                            value={formData.cpu}
                            onChange={(e) => setFormData({ ...formData, cpu: e.target.value })}
                            min={1}
                            step={1}
                            required
                          />
                          <p className="mt-1 text-xs text-zinc-600">100 = 1 thread</p>
                        </div>
                        <div>
                          <Label>Memory (MiB)</Label>
                          <Input
                            type="number"
                            value={formData.memory}
                            onChange={(e) => setFormData({ ...formData, memory: e.target.value })}
                            min={128}
                            step={128}
                            required
                          />
                        </div>
                        <div>
                          <Label>Disk (MiB)</Label>
                          <Input
                            type="number"
                            value={formData.disk}
                            onChange={(e) => setFormData({ ...formData, disk: e.target.value })}
                            min={1024}
                            step={1024}
                            required
                          />
                        </div>
                      </div>
                    </div>

                    {/* Advanced */}
                    <div className="border-t border-zinc-700/50 pt-6">
                      <h3 className="mb-4 text-sm font-medium tracking-wider text-zinc-300 uppercase">
                        Advanced
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>CPU Pinning</Label>
                          <Input
                            type="text"
                            value={formData.cpuPinning}
                            onChange={(e) =>
                              setFormData({ ...formData, cpuPinning: e.target.value })
                            }
                            placeholder="e.g., 0,1,2,3 or 0-3"
                          />
                        </div>
                        <div>
                          <Label>Swap (MiB)</Label>
                          <Input
                            type="number"
                            value={formData.swap}
                            onChange={(e) => setFormData({ ...formData, swap: e.target.value })}
                          />
                          <p className="mt-1 text-xs text-zinc-600">-1 = unlimited, 0 = disabled</p>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-4">
                        <div>
                          <Label>Backup Limit</Label>
                          <Input
                            type="number"
                            value={formData.backupLimit}
                            onChange={(e) =>
                              setFormData({ ...formData, backupLimit: e.target.value })
                            }
                            min={0}
                          />
                        </div>
                        <div className="flex items-center gap-3 pt-6">
                          <Input
                            type="checkbox"
                            id="oomKillDisable"
                            checked={formData.oomKillDisable}
                            onChange={(e) =>
                              setFormData({ ...formData, oomKillDisable: e.target.checked })
                            }
                            className="h-4 w-4"
                          />
                          <Label htmlFor="oomKillDisable">Disable OOM Killer</Label>
                        </div>
                      </div>
                    </div>

                    {/* Server Management */}
                    <div className="border-t border-zinc-700/50 pt-6">
                      <h3 className="mb-4 text-sm font-medium tracking-wider text-zinc-300 uppercase">
                        Server Management
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Server Status</Label>
                          <Select
                            value={selectedStatus}
                            onValueChange={handleStatusChange}
                            disabled={setStatus.isPending}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="STOPPED">Stopped</SelectItem>
                              <SelectItem value="RUNNING">Running</SelectItem>
                              <SelectItem value="STARTING">Starting</SelectItem>
                              <SelectItem value="STOPPING">Stopping</SelectItem>
                              <SelectItem value="INSTALLING">Installing</SelectItem>
                              <SelectItem value="SUSPENDED">Suspended</SelectItem>
                              <SelectItem value="ERROR">Error</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="mt-1 text-xs text-zinc-600">
                            Manually override server status
                          </p>
                        </div>
                        <div className="pt-6">
                          <TextureButton
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => setReinstallModalOpen(true)}
                          >
                            <BsArrowRepeat className="h-4 w-4" />
                            Reinstall Server
                          </TextureButton>
                          <p className="mt-1 text-xs text-zinc-600">
                            Wipes server and runs install script
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Blueprint Change */}
                    <div className="border-t border-zinc-700/50 pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-medium tracking-wider text-zinc-300 uppercase">
                            Core
                          </h3>
                          <p className="mt-1 text-xs text-zinc-500">
                            {server?.blueprint?.name || "No core selected"}
                          </p>
                        </div>
                        <TextureButton
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => setShowBlueprintModal(true)}
                        >
                          <BsSliders className="h-4 w-4" />
                          Change Core
                        </TextureButton>
                      </div>
                    </div>

                    {/* Allocations */}
                    <div className="border-t border-zinc-700/50 pt-6">
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-sm font-medium tracking-wider text-zinc-300 uppercase">
                          Allocations
                        </h3>
                        <TextureButton
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setShowAddAllocation(true);
                            loadAvailableAllocations();
                          }}
                        >
                          <BsPlus className="h-3 w-3" />
                          Add
                        </TextureButton>
                      </div>

                      {/* Current allocations list */}
                      <div className="space-y-2">
                        {isLoadingAllocations ? (
                          <div className="flex items-center justify-center py-4">
                            <Spinner className="h-4 w-4" />
                          </div>
                        ) : allocations.length === 0 ? (
                          <p className="py-4 text-center text-sm text-zinc-500">
                            No allocations assigned
                          </p>
                        ) : (
                          allocations.map((allocation, index) => (
                            <div
                              key={allocation.id}
                              className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 p-3"
                            >
                              <div className="flex items-center gap-3">
                                <BsHdd className="h-4 w-4 text-zinc-500" />
                                <span className="font-mono text-sm text-zinc-200">
                                  {allocation.ip}:{allocation.port}
                                </span>
                                {index === 0 && (
                                  <span className="rounded border border-emerald-500/30 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium tracking-wider text-emerald-400 uppercase">
                                    Primary
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
                                disabled={index === 0 || removingAllocationId === allocation.id}
                                onClick={() => handleRemoveAllocation(allocation.id)}
                                title={
                                  index === 0
                                    ? "Cannot remove primary allocation"
                                    : "Remove allocation"
                                }
                              >
                                {removingAllocationId === allocation.id ? (
                                  <Spinner className="h-4 w-4" />
                                ) : (
                                  <BsTrash className="h-4 w-4" />
                                )}
                              </TextureButton>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Add allocation dialog */}
                      {showAddAllocation && (
                        <div className="mt-4 rounded-lg border border-zinc-700 bg-zinc-900/50 p-4">
                          <p className="mb-3 text-sm text-zinc-300">
                            Select an available allocation to add:
                          </p>
                          <Select
                            value={selectedAllocationId}
                            onValueChange={setSelectedAllocationId}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select allocation..." />
                            </SelectTrigger>
                            <SelectContent>
                              {availableAllocations.map((alloc) => (
                                <SelectItem key={alloc.id} value={alloc.id}>
                                  {alloc.ip}:{alloc.port}
                                  {alloc.alias ? ` (${alloc.alias})` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {availableAllocations.length === 0 && (
                            <p className="mt-2 text-xs text-zinc-500">
                              No available allocations on this node
                            </p>
                          )}
                          <div className="mt-3 flex items-center gap-2">
                            <TextureButton
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setShowAddAllocation(false);
                                setSelectedAllocationId("");
                              }}
                            >
                              Cancel
                            </TextureButton>
                            <TextureButton
                              type="button"
                              variant="primary"
                              size="sm"
                              disabled={!selectedAllocationId || isAddingAllocation}
                              onClick={handleAddAllocation}
                            >
                              {isAddingAllocation ? (
                                <>
                                  <Spinner className="mr-1 h-3 w-3" />
                                  Adding...
                                </>
                              ) : (
                                "Add Allocation"
                              )}
                            </TextureButton>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Server Splitting */}
                    <div className="border-t border-zinc-700/50 pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-medium tracking-wider text-zinc-300 uppercase">
                            Server Splitting
                          </h3>
                          <p className="mt-1 text-xs text-zinc-500">
                            {server?.parentServerId
                              ? "This is a child server"
                              : "Split resources to create child servers"}
                          </p>
                        </div>
                        <TextureButton
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => router.push(`/servers/${serverId}/split`)}
                        >
                          <BsSliders className="h-4 w-4" />
                          Manage
                          <BsBoxArrowRight className="h-3 w-3" />
                        </TextureButton>
                      </div>
                    </div>

                    {/* Server Transfer */}
                    <div className="border-t border-zinc-700/50 pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-medium tracking-wider text-zinc-300 uppercase">
                            Server Transfer
                          </h3>
                          <p className="mt-1 text-xs text-zinc-500">
                            Transfer server to another node
                          </p>
                        </div>
                        <TextureButton
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => setShowTransferHistory(!showTransferHistory)}
                        >
                          {showTransferHistory ? "Hide History" : "Show History"}
                        </TextureButton>
                      </div>

                      {/* Transfer History */}
                      {showTransferHistory && transferStatus && (
                        <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                          <div className="mb-2 flex items-center justify-between text-zinc-300">
                            <span className="text-sm">Transfer Status</span>
                            <span
                              className={cn(
                                "text-xs font-medium",
                                transferStatus.status === "PENDING"
                                  ? "text-yellow-400"
                                  : transferStatus.status === "COMPLETED"
                                    ? "text-green-400"
                                    : transferStatus.status === "FAILED"
                                      ? "text-red-400"
                                      : "text-zinc-500"
                              )}
                            >
                              {transferStatus.status}
                            </span>
                          </div>
                          {transferStatus.progress > 0 && (
                            <div className="mb-2 h-2 overflow-hidden rounded-full bg-zinc-800">
                              <div
                                className="h-full rounded-full bg-blue-500 transition-all"
                                style={{ width: `${transferStatus.progress}%` }}
                              />
                            </div>
                          )}
                          <div className="space-y-2 text-xs">
                            <div>
                              <span className="text-zinc-500">From:</span>{" "}
                              <span className="text-zinc-300">
                                {transferStatus.sourceNode?.displayName || "Unknown"}
                              </span>
                            </div>
                            <div>
                              <span className="text-zinc-500">To:</span>{" "}
                              <span className="text-zinc-300">
                                {transferStatus.targetNode?.displayName || "Unknown"}
                              </span>
                            </div>
                            {transferStatus.error && (
                              <div>
                                <span className="text-zinc-500">Error:</span>{" "}
                                <span className="text-red-400">{transferStatus.error}</span>
                              </div>
                            )}
                          </div>
                          {transferStatus.status !== "COMPLETED" &&
                            transferStatus.status !== "FAILED" && (
                              <div className="flex gap-2 pt-2">
                                <TextureButton
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  onClick={handleCancelTransfer}
                                >
                                  Cancel Transfer
                                </TextureButton>
                              </div>
                            )}
                        </div>
                      )}

                      {!showTransferHistory && (
                        <div className="mt-4">
                          <TextureButton
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => setShowTransferModal(true)}
                            disabled={
                              !!transferStatus &&
                              transferStatus.status !== "COMPLETED" &&
                              transferStatus.status !== "FAILED"
                            }
                          >
                            Start Transfer
                          </TextureButton>
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
                  variant="secondary"
                  size="sm"
                  onClick={() => router.push("/admin/servers")}
                >
                  Cancel
                </TextureButton>
                <TextureButton
                  type="submit"
                  variant="primary"
                  size="sm"
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
        </div>
      </div>

      {/* Reinstall Confirmation Modal */}
      <ConfirmationModal
        open={reinstallModalOpen}
        onOpenChange={setReinstallModalOpen}
        onConfirm={handleReinstall}
        title="Reinstall Server"
        description="This will completely wipe the server's files and run the installation script again. All data will be lost. This action cannot be undone."
        confirmLabel={isReinstalling ? "Reinstalling..." : "Reinstall"}
        isLoading={isReinstalling}
      />

      {/* Blueprint Change Modal */}
      {showBlueprintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <h2 className="mb-4 text-lg font-medium text-zinc-100">Change Core</h2>
            <p className="mb-4 text-sm text-zinc-400">
              Select a new core for this server. Changing the core will update the server's
              configuration and runtime environment.
            </p>

            {isLoadingBlueprints ? (
              <div className="flex items-center justify-center py-8">
                <Spinner className="h-6 w-6" />
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label>Core</Label>
                  <Select value={selectedBlueprintId} onValueChange={setSelectedBlueprintId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select core..." />
                    </SelectTrigger>
                    <SelectContent>
                      {blueprintList.map((blueprint) => (
                        <SelectItem key={blueprint.id} value={blueprint.id}>
                          {blueprint.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Input
                    type="checkbox"
                    id="reinstallOnBlueprintChange"
                    checked={reinstallOnBlueprintChange}
                    onChange={(e) => setReinstallOnBlueprintChange(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="reinstallOnBlueprintChange">
                    Reinstall server after changing core
                  </Label>
                </div>
                <p className="text-xs text-zinc-500">
                  Warning: Reinstalling will wipe all server files. Uncheck if you only want to
                  change the core configuration.
                </p>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <TextureButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setShowBlueprintModal(false);
                  setSelectedBlueprintId(server?.blueprintId || "");
                  setReinstallOnBlueprintChange(false);
                }}
                disabled={isChangingBlueprint}
              >
                Cancel
              </TextureButton>
              <TextureButton
                type="button"
                variant="primary"
                size="sm"
                disabled={!selectedBlueprintId || isChangingBlueprint}
                onClick={handleChangeBlueprint}
              >
                {isChangingBlueprint ? "Changing..." : "Change Core"}
              </TextureButton>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <h2 className="mb-4 text-lg font-medium text-zinc-100">Transfer Server</h2>
            <p className="mb-6 text-sm text-zinc-400">
              Select a target node to transfer this server to. The server will be archived and moved
              to the new node.
            </p>

            {isLoadingNodes ? (
              <div className="flex items-center justify-center py-8">
                <Spinner className="h-6 w-6" />
              </div>
            ) : (
              <>
                <div>
                  <Label>Target Node</Label>
                  <Select value={selectedTargetNodeId} onValueChange={setSelectedTargetNodeId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select node..." />
                    </SelectTrigger>
                    <SelectContent>
                      {nodesList
                        .filter((node) => node.id !== server?.nodeId)
                        .map((node) => (
                          <SelectItem key={node.id} value={node.id}>
                            {node.displayName} ({node.location?.name || "Unknown"})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {server?.node && (
                    <p className="mt-2 text-xs text-zinc-500">
                      Current node: {server.node.displayName}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <TextureButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setShowTransferModal(false);
                      setSelectedTargetNodeId("");
                    }}
                    disabled={isTransferring}
                  >
                    Cancel
                  </TextureButton>
                  <TextureButton
                    type="button"
                    variant="primary"
                    size="sm"
                    disabled={!selectedTargetNodeId || isTransferring}
                    onClick={handleStartTransfer}
                  >
                    {isTransferring ? "Transferring..." : "Start Transfer"}
                  </TextureButton>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </FadeIn>
  );
}

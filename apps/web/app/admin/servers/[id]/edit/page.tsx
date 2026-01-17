"use client";

import {useEffect, useState} from "react";
import {useParams, useRouter} from "next/navigation";
import {cn} from "@workspace/ui/lib/utils";
import {Button} from "@workspace/ui/components/button";
import {Spinner} from "@workspace/ui/components/spinner";
import {AnimatedBackground} from "@workspace/ui/components/animated-background";
import {FadeIn} from "@workspace/ui/components/fade-in";
import {FloatingDots} from "@workspace/ui/components/floating-particles";
import {
  ArrowLeftIcon,
  ExternalLinkIcon,
  NetworkIcon,
  PlusIcon,
  RefreshCwIcon,
  SaveIcon,
  SplitIcon,
  TrashIcon,
} from "lucide-react";
import {useServer, useServerMutations} from "@/hooks/queries";
import {CornerAccents, useAdminTheme} from "@/hooks/use-admin-theme";
import {ConfirmationModal} from "@workspace/ui/components/confirmation-modal";
import {toast} from "sonner";
import type {Node} from "@/lib/api";
import {Allocation, Blueprint, blueprints, nodes, servers} from "@/lib/api";

export default function EditServerPage() {
  const router = useRouter();
  const params = useParams();
  const serverId = params.id as string;
  const { mounted, inputClasses, labelClasses } = useAdminTheme();

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

  // Form state - use strings for number fields to allow empty state while editing
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
      // Set initial allocations from server data
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
      } catch (error: any) {
        toast.error("Failed to load blueprints");
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
      } catch (error: any) {
        toast.error("Failed to load nodes");
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
    } catch (error: any) {
      toast.error("Failed to load allocations");
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
    } catch (error: any) {
      toast.error("Failed to load available allocations");
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
    } catch (error: any) {
      toast.error(error.message || "Failed to add allocation");
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
    } catch (error: any) {
      toast.error(error.message || "Failed to remove allocation");
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
    } catch (error: any) {
      toast.error(error.message || "Failed to initiate transfer");
    } finally {
      setIsTransferring(false);
    }
  };

  const fetchTransferStatus = async () => {
    if (!serverId) return;
    try {
      const status = await servers.transfer.get(serverId);
      setTransferStatus(status);
    } catch (error: any) {
      console.error("Failed to fetch transfer status", error);
    }
  };

  const handleCancelTransfer = async () => {
    if (!serverId) return;
    try {
      await servers.transfer.cancel(serverId);
      toast.success("Transfer cancelled");
      setTransferStatus(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to cancel transfer");
    }
  };

  // Load transfer status when component mounts or modal opens
  useEffect(() => {
    if (showTransferModal && serverId) {
      fetchTransferStatus();
      const interval = setInterval(fetchTransferStatus, 5000); // Poll every 5 seconds
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
    } catch (error: any) {
      toast.error(error.message || "Failed to reinstall server");
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
    } catch (error: any) {
      toast.error(error.message || "Failed to update server status");
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
    } catch (error: any) {
      toast.error(error.message || "Failed to change server blueprint");
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
    } catch (error: any) {
      toast.error(error.message || "Failed to update server");
    }
  };

  if (!mounted) return null;

  if (isLoading) {
    return (
      <div
        className={cn(
          "relative flex min-h-svh items-center justify-center bg-[#0b0b0a]",
        )}
      >
        <AnimatedBackground />
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative min-h-svh transition-colors bg-[#0b0b0a]",
      )}
    >
      <AnimatedBackground  />
      <FloatingDots count={15} />

      <div className="relative p-8">
        <div className="mx-auto max-w-2xl">
          <FadeIn delay={0}>
            {/* Header */}
            <div className="mb-8 flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/admin/servers")}
                className={cn(
                  "p-2 transition-all hover:scale-110 active:scale-95 text-zinc-400 hover:text-zinc-100",
                )}
              >
                <ArrowLeftIcon className="h-4 w-4" />
              </Button>
              <div>
                <h1
                  className={cn(
                    "text-2xl font-light tracking-wider text-zinc-100",
                  )}
                >
                  EDIT SERVER
                </h1>
                <p className={cn("mt-1 text-sm text-zinc-500")}>
                  {server?.name} ({server?.shortId})
                </p>
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={0.1}>
            <form onSubmit={handleSubmit}>
              <div
                className={cn(
                  "relative border p-6 border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] shadow-lg shadow-black/20",
                )}
              >
                <CornerAccents size="sm" />

                <div className="space-y-4">
                  {/* Basic Info */}
                  <div>
                    <label className={labelClasses}>Name</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className={inputClasses}
                      required
                    />
                  </div>

                  <div>
                    <label className={labelClasses}>Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className={cn(inputClasses, "h-20 resize-none")}
                      placeholder="Optional description..."
                    />
                  </div>

                  {/* Resources */}
                  <div
                    className={cn(
                      "border-t pt-4 border-zinc-700/50",
                    )}
                  >
                    <h3
                      className={cn(
                        "mb-4 text-sm font-medium tracking-wider uppercase text-zinc-300",
                      )}
                    >
                      Resources
                    </h3>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className={labelClasses}>CPU (%)</label>
                        <input
                          type="number"
                          value={formData.cpu}
                          onChange={(e) => setFormData({ ...formData, cpu: e.target.value })}
                          className={inputClasses}
                          min={1}
                          step={1}
                          required
                        />
                        <p
                          className={cn("mt-1 text-xs text-zinc-600")}
                        >
                          100 = 1 thread
                        </p>
                      </div>
                      <div>
                        <label className={labelClasses}>Memory (MiB)</label>
                        <input
                          type="number"
                          value={formData.memory}
                          onChange={(e) => setFormData({ ...formData, memory: e.target.value })}
                          className={inputClasses}
                          min={128}
                          step={128}
                          required
                        />
                      </div>
                      <div>
                        <label className={labelClasses}>Disk (MiB)</label>
                        <input
                          type="number"
                          value={formData.disk}
                          onChange={(e) => setFormData({ ...formData, disk: e.target.value })}
                          className={inputClasses}
                          min={1024}
                          step={1024}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Advanced */}
                  <div
                    className={cn(
                      "border-t pt-4 border-zinc-700/50",
                    )}
                  >
                    <h3
                      className={cn(
                        "mb-4 text-sm font-medium tracking-wider uppercase text-zinc-300",
                      )}
                    >
                      Advanced
                    </h3>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelClasses}>CPU Pinning</label>
                        <input
                          type="text"
                          value={formData.cpuPinning}
                          onChange={(e) => setFormData({ ...formData, cpuPinning: e.target.value })}
                          className={inputClasses}
                          placeholder="e.g., 0,1,2,3 or 0-3"
                        />
                      </div>
                      <div>
                        <label className={labelClasses}>Swap (MiB)</label>
                        <input
                          type="number"
                          value={formData.swap}
                          onChange={(e) => setFormData({ ...formData, swap: e.target.value })}
                          className={inputClasses}
                        />
                        <p
                          className={cn("mt-1 text-xs text-zinc-600")}
                        >
                          -1 = unlimited, 0 = disabled
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelClasses}>Backup Limit</label>
                        <input
                          type="number"
                          value={formData.backupLimit}
                          onChange={(e) =>
                            setFormData({ ...formData, backupLimit: e.target.value })
                          }
                          className={inputClasses}
                          min={0}
                        />
                      </div>
                      <div className="flex items-center gap-3 pt-6">
                        <input
                          type="checkbox"
                          id="oomKillDisable"
                          checked={formData.oomKillDisable}
                          onChange={(e) =>
                            setFormData({ ...formData, oomKillDisable: e.target.checked })
                          }
                          className="h-4 w-4"
                        />
                        <label
                          htmlFor="oomKillDisable"
                          className={cn("text-sm text-zinc-300")}
                        >
                          Disable OOM Killer
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Server Management */}
                  <div
                    className={cn(
                      "border-t pt-4 border-zinc-700/50",
                    )}
                  >
                    <h3
                      className={cn(
                        "mb-4 text-sm font-medium tracking-wider uppercase text-zinc-300",
                      )}
                    >
                      Server Management
                    </h3>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelClasses}>Server Status</label>
                        <select
                          value={selectedStatus}
                          onChange={(e) => handleStatusChange(e.target.value)}
                          className={inputClasses}
                          disabled={setStatus.isPending}
                        >
                          <option value="STOPPED">Stopped</option>
                          <option value="RUNNING">Running</option>
                          <option value="STARTING">Starting</option>
                          <option value="STOPPING">Stopping</option>
                          <option value="INSTALLING">Installing</option>
                          <option value="SUSPENDED">Suspended</option>
                          <option value="ERROR">Error</option>
                        </select>
                        <p
                          className={cn("mt-1 text-xs text-zinc-600")}
                        >
                          Manually override server status
                        </p>
                      </div>
                      <div className="pt-6">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setReinstallModalOpen(true)}
                          className={cn(
                            "flex w-full items-center justify-center gap-2 text-xs tracking-wider uppercase transition-all hover:scale-[1.02] active:scale-95 border-amber-700/50 text-amber-400 hover:border-amber-500 hover:text-amber-300",
                          )}
                        >
                          <RefreshCwIcon className="h-4 w-4" />
                          Reinstall Server
                        </Button>
                        <p
                          className={cn(
                            "mt-1 text-center text-xs text-zinc-600",
                          )}
                        >
                          Wipes server and runs install script
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Blueprint Change */}
                  <div
                    className={cn(
                      "border-t pt-4 border-zinc-700/50",
                    )}
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h3
                          className={cn(
                            "text-sm font-medium tracking-wider uppercase text-zinc-300",
                          )}
                        >
                          Game Type
                        </h3>
                        <p
                          className={cn("mt-1 text-xs text-zinc-500")}
                        >
                          {server?.blueprint?.name || "No blueprint selected"}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowBlueprintModal(true)}
                        className={cn(
                          "flex items-center gap-2 text-xs tracking-wider uppercase border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200",
                        )}
                      >
                        Change Blueprint
                      </Button>
                    </div>
                  </div>

                  {/* Allocations */}
                  <div
                    className={cn(
                      "border-t pt-4 border-zinc-700/50",
                    )}
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <h3
                        className={cn(
                          "text-sm font-medium tracking-wider uppercase text-zinc-300",
                        )}
                      >
                        Allocations
                      </h3>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowAddAllocation(true);
                          loadAvailableAllocations();
                        }}
                        className={cn(
                          "flex items-center gap-1 text-xs border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200",
                        )}
                      >
                        <PlusIcon className="h-3 w-3" />
                        Add
                      </Button>
                    </div>

                    {/* Current allocations list */}
                    <div className="space-y-2">
                      {isLoadingAllocations ? (
                        <div className="flex items-center justify-center py-4">
                          <Spinner className="h-4 w-4" />
                        </div>
                      ) : allocations.length === 0 ? (
                        <p
                          className={cn(
                            "py-4 text-center text-sm text-zinc-500"
                          )}
                        >
                          No allocations assigned
                        </p>
                      ) : (
                        allocations.map((allocation, index) => (
                          <div
                            key={allocation.id}
                            className={cn(
                              "flex items-center justify-between border p-3 border-zinc-800 bg-zinc-900/50",
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <NetworkIcon
                                className={cn(
                                  "h-4 w-4 text-zinc-500",
                                )}
                              />
                              <span
                                className={cn(
                                  "font-mono text-sm text-zinc-200",
                                )}
                              >
                                {allocation.ip}:{allocation.port}
                              </span>
                              {index === 0 && (
                                <span
                                  className={cn(
                                    "px-2 py-0.5 text-[10px] font-medium tracking-wider uppercase border border-emerald-500/30 bg-emerald-500/20 text-emerald-400",
                                  )}
                                >
                                  Primary
                                </span>
                              )}
                              {allocation.alias && (
                                <span
                                  className={cn(
                                    "text-xs text-zinc-500",
                                  )}
                                >
                                  ({allocation.alias})
                                </span>
                              )}
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={index === 0 || removingAllocationId === allocation.id}
                              onClick={() => handleRemoveAllocation(allocation.id)}
                              className={cn(
                                "h-auto p-1",
                                index === 0
                                  ? "cursor-not-allowed opacity-30"
                                  : "text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
                              )}
                              title={
                                index === 0
                                  ? "Cannot remove primary allocation"
                                  : "Remove allocation"
                              }
                            >
                              {removingAllocationId === allocation.id ? (
                                <Spinner className="h-4 w-4" />
                              ) : (
                                <TrashIcon className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Add allocation dialog */}
                    {showAddAllocation && (
                      <div
                        className={cn(
                          "mt-4 border p-4 border-zinc-700 bg-zinc-900/50",
                        )}
                      >
                        <p
                          className={cn("mb-3 text-sm text-zinc-300")}
                        >
                          Select an available allocation to add:
                        </p>
                        <select
                          value={selectedAllocationId}
                          onChange={(e) => setSelectedAllocationId(e.target.value)}
                          className={inputClasses}
                        >
                          <option value="">Select allocation...</option>
                          {availableAllocations.map((alloc) => (
                            <option key={alloc.id} value={alloc.id}>
                              {alloc.ip}:{alloc.port}
                              {alloc.alias ? ` (${alloc.alias})` : ""}
                            </option>
                          ))}
                        </select>
                        {availableAllocations.length === 0 && (
                          <p
                            className={cn(
                              "mt-2 text-xs text-zinc-500",
                            )}
                          >
                            No available allocations on this node
                          </p>
                        )}
                        <div className="mt-3 flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setShowAddAllocation(false);
                              setSelectedAllocationId("");
                            }}
                            className={cn(
                              "text-xs border-zinc-700 text-zinc-400",
                            )}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={!selectedAllocationId || isAddingAllocation}
                            onClick={handleAddAllocation}
                            className={cn(
                              "text-xs bg-zinc-100 text-zinc-900 hover:bg-zinc-200",
                            )}
                          >
                            {isAddingAllocation ? (
                              <>
                                <Spinner className="mr-1 h-3 w-3" />
                                Adding...
                              </>
                            ) : (
                              "Add Allocation"
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Server Splitting */}
                  <div
                    className={cn(
                      "border-t pt-4 border-zinc-700/50",
                    )}
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h3
                          className={cn(
                            "text-sm font-medium tracking-wider uppercase text-zinc-300",
                          )}
                        >
                          Server Splitting
                        </h3>
                        <p
                          className={cn("mt-1 text-xs text-zinc-500")}
                        >
                          {server?.parentServerId
                            ? "This is a child server"
                            : "Split resources to create child servers"}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/servers/${serverId}/split`)}
                        className={cn(
                          "flex items-center gap-2 text-xs tracking-wider uppercase border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200",
                        )}
                      >
                        <SplitIcon className="h-4 w-4" />
                        Manage
                        <ExternalLinkIcon className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Server Transfer */}
                  <div
                    className={cn(
                      "border-t pt-4 border-zinc-700/50",
                    )}
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h3
                          className={cn(
                            "text-sm font-medium tracking-wider uppercase text-zinc-300",
                          )}
                        >
                          Server Transfer
                        </h3>
                        <p
                          className={cn("mt-1 text-xs text-zinc-500")}
                        >
                          Transfer server to another node
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowTransferHistory(!showTransferHistory)}
                        className={cn(
                          "flex items-center gap-2 text-xs tracking-wider uppercase border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200",
                        )}
                      >
                        {showTransferHistory ? "Hide History" : "Show History"}
                      </Button>
                    </div>

                    {/* Transfer History */}
                    {showTransferHistory && transferStatus && (
                      <div
                        className={cn(
                          "mb-4 border p-4 border-zinc-800 bg-zinc-900/50",
                        )}
                      >
                        <div
                          className={cn(
                            "mb-2 flex items-center justify-between text-zinc-300",
                          )}
                        >
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
                          <div
                            className={cn(
                              "mb-2 h-2 overflow-hidden rounded-full bg-zinc-800",
                            )}
                          >
                            <div
                              className="h-full rounded-full bg-blue-500 transition-all"
                              style={{ width: `${transferStatus.progress}%` }}
                            />
                          </div>
                        )}
                        <div className="space-y-2 text-xs">
                          <div>
                            <span className={cn("text-zinc-500")}>
                              From:
                            </span>{" "}
                            <span className={cn("text-zinc-300")}>
                              {transferStatus.sourceNode?.displayName || "Unknown"}
                            </span>
                          </div>
                          <div>
                            <span className={cn("text-zinc-500")}>
                              To:
                            </span>{" "}
                            <span className={cn("text-zinc-300")}>
                              {transferStatus.targetNode?.displayName || "Unknown"}
                            </span>
                          </div>
                          {transferStatus.error && (
                            <div>
                              <span className={cn("text-zinc-500")}>
                                Error:
                              </span>{" "}
                              <span className="text-red-400">{transferStatus.error}</span>
                            </div>
                          )}
                        </div>
                        {transferStatus.status !== "COMPLETED" &&
                          transferStatus.status !== "FAILED" && (
                            <div className="flex gap-2 pt-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleCancelTransfer}
                                className={cn(
                                  "text-xs tracking-wider uppercase border-red-700/50 text-red-400 hover:border-red-600 hover:text-red-300",
                                )}
                              >
                                Cancel Transfer
                              </Button>
                            </div>
                          )}
                      </div>
                    )}

                    {!showTransferHistory && (
                      <div className="mt-4">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setShowTransferModal(true)}
                          disabled={
                            !!transferStatus &&
                            transferStatus.status !== "COMPLETED" &&
                            transferStatus.status !== "FAILED"
                          }
                          className={cn(
                            "flex w-full items-center gap-2 text-xs tracking-wider uppercase border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40",
                          )}
                        >
                          Start Transfer
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="mt-6 flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/admin/servers")}
                  className={cn(
                    "text-xs tracking-wider uppercase transition-all hover:scale-[1.02] active:scale-95 border-zinc-700 text-zinc-400",
                  )}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={update.isPending}
                  className={cn(
                    "flex items-center gap-2 text-xs tracking-wider uppercase transition-all hover:scale-[1.02] active:scale-95 bg-zinc-100 text-zinc-900 hover:bg-zinc-200",
                  )}
                >
                  {update.isPending ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    <SaveIcon className="h-4 w-4" />
                  )}
                  {update.isPending ? "Saving..." : "Save Changes"}
                </Button>
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
        variant="danger"
        isLoading={isReinstalling}
      />

      {/* Blueprint Change Modal */}
      {showBlueprintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div
            className={cn(
              "w-full max-w-md border p-6 shadow-2xl border-zinc-800 bg-zinc-900",
            )}
          >
            <h2
              className={cn("mb-4 text-lg font-medium text-zinc-100")}
            >
              Change Game Type
            </h2>
            <p className={cn("mb-4 text-sm text-zinc-400")}>
              Select a new blueprint for this server. Changing the blueprint will update the
              server's game type and configuration.
            </p>

            {isLoadingBlueprints ? (
              <div className="flex items-center justify-center py-8">
                <Spinner className="h-6 w-6" />
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className={labelClasses}>Blueprint</label>
                  <select
                    value={selectedBlueprintId}
                    onChange={(e) => setSelectedBlueprintId(e.target.value)}
                    className={inputClasses}
                  >
                    <option value="">Select blueprint...</option>
                    {blueprintList.map((blueprint) => (
                      <option key={blueprint.id} value={blueprint.id}>
                        {blueprint.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <input
                    type="checkbox"
                    id="reinstallOnBlueprintChange"
                    checked={reinstallOnBlueprintChange}
                    onChange={(e) => setReinstallOnBlueprintChange(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <label
                    htmlFor="reinstallOnBlueprintChange"
                    className={cn("text-sm text-zinc-300")}
                  >
                    Reinstall server after changing blueprint
                  </label>
                </div>
                <p className={cn("text-xs text-zinc-500")}>
                  Warning: Reinstalling will wipe all server files. Uncheck if you only want to
                  change the blueprint configuration.
                </p>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowBlueprintModal(false);
                  setSelectedBlueprintId(server?.blueprintId || "");
                  setReinstallOnBlueprintChange(false);
                }}
                disabled={isChangingBlueprint}
                className={cn(
                  "text-xs tracking-wider uppercase border-zinc-700 text-zinc-400",
                )}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!selectedBlueprintId || isChangingBlueprint}
                onClick={handleChangeBlueprint}
                className={cn(
                  "text-xs tracking-wider uppercase bg-blue-600 text-white hover:bg-blue-700",
                )}
              >
                {isChangingBlueprint ? "Changing..." : "Change Blueprint"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div
            className={cn(
              "w-full max-w-md border p-6 shadow-2xl border-zinc-800 bg-zinc-900",
            )}
          >
            <h2
              className={cn("mb-4 text-lg font-medium text-zinc-100")}
            >
              Transfer Server
            </h2>
            <p className={cn("mb-6 text-sm text-zinc-400")}>
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
                  <label className={labelClasses}>Target Node</label>
                  <select
                    value={selectedTargetNodeId}
                    onChange={(e) => setSelectedTargetNodeId(e.target.value)}
                    className={inputClasses}
                  >
                    <option value="">Select node...</option>
                    {nodesList
                      .filter((node) => node.id !== server?.nodeId)
                      .map((node) => (
                        <option key={node.id} value={node.id}>
                          {node.displayName} ({node.location?.name || "Unknown"})
                        </option>
                      ))}
                  </select>
                  {server?.node && (
                    <p className={cn("mt-2 text-xs text-zinc-500")}>
                      Current node: {server.node.displayName}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowTransferModal(false);
                      setSelectedTargetNodeId("");
                    }}
                    disabled={isTransferring}
                    className={cn(
                      "text-xs tracking-wider uppercase border-zinc-700 text-zinc-400",
                    )}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    disabled={!selectedTargetNodeId || isTransferring}
                    onClick={handleStartTransfer}
                    className={cn(
                      "text-xs tracking-wider uppercase bg-blue-600 text-white hover:bg-blue-700",
                    )}
                  >
                    {isTransferring ? "Transferring..." : "Start Transfer"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

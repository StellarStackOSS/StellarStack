"use client";

import {useEffect, useState} from "react";
import {useParams, useRouter} from "next/navigation";
import {cn} from "@workspace/ui/lib/utils";
import {Button} from "@workspace/ui/components/button";
import {Spinner} from "@workspace/ui/components/spinner";
import {AnimatedBackground} from "@workspace/ui/components/animated-background";
import {FadeIn} from "@workspace/ui/components/fade-in";
import {FloatingDots} from "@workspace/ui/components/floating-particles";
import {ConfirmationModal} from "@workspace/ui/components/confirmation-modal";
import {ArrowLeftIcon, KeyIcon, NetworkIcon, PlusIcon, SaveIcon, TrashIcon} from "lucide-react";
import {useNode, useNodeMutations} from "@/hooks/queries";
import {CornerAccents, useAdminTheme} from "@/hooks/use-admin-theme";
import {toast} from "sonner";

export default function EditNodePage() {
  const router = useRouter();
  const params = useParams();
  const nodeId = params.id as string;
  const { mounted, isDark, inputClasses, labelClasses, selectClasses } = useAdminTheme();

  // React Query hooks
  const { data: node, isLoading, refetch } = useNode(nodeId);
  const { update, regenerateToken, addAllocation, addAllocationRange, deleteAllocation } =
    useNodeMutations();

  // Token state
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [newToken, setNewToken] = useState<{
    token: string;
    token_id: string;
  } | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  // Allocation state
  const [showAddAllocation, setShowAddAllocation] = useState(false);
  const [showAddRange, setShowAddRange] = useState(false);
  const [allocationForm, setAllocationForm] = useState({ ip: "", port: 25565, alias: "" });
  const [rangeForm, setRangeForm] = useState({ ip: "", startPort: 25565, endPort: 25575 });
  const [deletingAllocationId, setDeletingAllocationId] = useState<string | null>(null);

  // Form state
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await update.mutateAsync({
        id: nodeId,
        data: formData,
      });
      toast.success("Node updated successfully");
      router.push("/admin/nodes");
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

  const formatBytes = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return gb >= 1 ? `${gb.toFixed(0)} GB` : `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  };

  if (!mounted) return null;

  if (isLoading) {
    return (
      <div
        className={cn(
          "relative flex min-h-svh items-center justify-center",
          isDark ? "bg-[#0b0b0a]" : "bg-[#f5f5f4]"
        )}
      >
        <AnimatedBackground isDark={isDark} />
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (!node) {
    return (
      <div
        className={cn(
          "relative flex min-h-svh items-center justify-center",
          isDark ? "bg-[#0b0b0a]" : "bg-[#f5f5f4]"
        )}
      >
        <AnimatedBackground isDark={isDark} />
        <p className={isDark ? "text-zinc-400" : "text-zinc-600"}>Node not found</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative min-h-svh transition-colors",
        isDark ? "bg-[#0b0b0a]" : "bg-[#f5f5f4]"
      )}
    >
      <AnimatedBackground isDark={isDark} />
      <FloatingDots isDark={isDark} count={15} />

      <div className="relative p-8">
        <div className="mx-auto max-w-3xl">
          <FadeIn delay={0}>
            {/* Header */}
            <div className="mb-8 flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/admin/nodes")}
                className={cn(
                  "p-2 transition-all hover:scale-110 active:scale-95",
                  isDark ? "text-zinc-400 hover:text-zinc-100" : "text-zinc-600 hover:text-zinc-900"
                )}
              >
                <ArrowLeftIcon className="h-4 w-4" />
              </Button>
              <div>
                <h1
                  className={cn(
                    "text-2xl font-light tracking-wider",
                    isDark ? "text-zinc-100" : "text-zinc-800"
                  )}
                >
                  EDIT NODE
                </h1>
                <p className={cn("mt-1 text-sm", isDark ? "text-zinc-500" : "text-zinc-500")}>
                  {node.displayName} - {node.host}:{node.port}
                </p>
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={0.1}>
            <form onSubmit={handleSubmit}>
              <div
                className={cn(
                  "relative border p-6",
                  isDark
                    ? "border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] shadow-lg shadow-black/20"
                    : "border-zinc-300 bg-gradient-to-b from-white via-zinc-50 to-zinc-100 shadow-lg shadow-zinc-400/20"
                )}
              >
                <CornerAccents isDark={isDark} size="sm" />

                <div className="space-y-4">
                  {/* Basic Info */}
                  <div>
                    <label className={labelClasses}>Display Name</label>
                    <input
                      type="text"
                      value={formData.displayName}
                      onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
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
                        className={inputClasses}
                        placeholder="daemon.example.com"
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
                        min={1}
                        max={65535}
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
                          setFormData({ ...formData, protocol: e.target.value as any })
                        }
                        className={selectClasses}
                      >
                        <option value="HTTP">HTTP</option>
                        <option value="HTTPS">HTTPS</option>
                        <option value="HTTPS_PROXY">HTTPS (Proxy)</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClasses}>SFTP Port</label>
                      <input
                        type="number"
                        value={formData.sftpPort}
                        onChange={(e) =>
                          setFormData({ ...formData, sftpPort: parseInt(e.target.value) || 2022 })
                        }
                        className={inputClasses}
                        min={1}
                        max={65535}
                        required
                      />
                    </div>
                  </div>

                  {/* Resource Limits */}
                  <div
                    className={cn(
                      "border-t pt-4",
                      isDark ? "border-zinc-700/50" : "border-zinc-200"
                    )}
                  >
                    <h3
                      className={cn(
                        "mb-4 text-sm font-medium tracking-wider uppercase",
                        isDark ? "text-zinc-300" : "text-zinc-700"
                      )}
                    >
                      Resource Limits
                    </h3>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelClasses}>Memory Limit (bytes)</label>
                        <input
                          type="number"
                          value={formData.memoryLimit}
                          onChange={(e) =>
                            setFormData({ ...formData, memoryLimit: parseInt(e.target.value) || 0 })
                          }
                          className={inputClasses}
                          min={0}
                          required
                        />
                        <p
                          className={cn("mt-1 text-xs", isDark ? "text-zinc-600" : "text-zinc-400")}
                        >
                          {formatBytes(formData.memoryLimit)}
                        </p>
                      </div>
                      <div>
                        <label className={labelClasses}>Disk Limit (bytes)</label>
                        <input
                          type="number"
                          value={formData.diskLimit}
                          onChange={(e) =>
                            setFormData({ ...formData, diskLimit: parseInt(e.target.value) || 0 })
                          }
                          className={inputClasses}
                          min={0}
                          required
                        />
                        <p
                          className={cn("mt-1 text-xs", isDark ? "text-zinc-600" : "text-zinc-400")}
                        >
                          {formatBytes(formData.diskLimit)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelClasses}>CPU Limit (cores)</label>
                        <input
                          type="number"
                          value={formData.cpuLimit}
                          onChange={(e) =>
                            setFormData({ ...formData, cpuLimit: parseFloat(e.target.value) || 1 })
                          }
                          className={inputClasses}
                          min={0.1}
                          step={0.1}
                          required
                        />
                      </div>
                      <div>
                        <label className={labelClasses}>Upload Limit (bytes)</label>
                        <input
                          type="number"
                          value={formData.uploadLimit}
                          onChange={(e) =>
                            setFormData({ ...formData, uploadLimit: parseInt(e.target.value) || 0 })
                          }
                          className={inputClasses}
                          min={0}
                          required
                        />
                        <p
                          className={cn("mt-1 text-xs", isDark ? "text-zinc-600" : "text-zinc-400")}
                        >
                          {formatBytes(formData.uploadLimit)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Token Management */}
                  <div
                    className={cn(
                      "border-t pt-4",
                      isDark ? "border-zinc-700/50" : "border-zinc-200"
                    )}
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <h3
                        className={cn(
                          "text-sm font-medium tracking-wider uppercase",
                          isDark ? "text-zinc-300" : "text-zinc-700"
                        )}
                      >
                        Daemon Token
                      </h3>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowRegenerateConfirm(true)}
                        className={cn(
                          "flex items-center gap-1 text-xs",
                          isDark
                            ? "border-amber-700/50 text-amber-400 hover:border-amber-500"
                            : "border-amber-400 text-amber-600 hover:border-amber-500"
                        )}
                      >
                        <KeyIcon className="h-3 w-3" />
                        Regenerate
                      </Button>
                    </div>
                    {newToken && (
                      <div
                        className={cn(
                          "flex flex-col justify-between gap-2 border p-3 font-mono text-xs break-all",
                          isDark
                            ? "border-zinc-700 bg-zinc-950 text-zinc-300"
                            : "border-zinc-200 bg-zinc-50 text-zinc-700"
                        )}
                      >
                        <span className="flex-1">TOKENID: {newToken.token_id}</span>
                        <span>TOKEN: {newToken.token}</span>
                      </div>
                    )}
                    {!newToken && (
                      <p className={cn("text-xs", isDark ? "text-zinc-500" : "text-zinc-400")}>
                        Token is only shown once when created or regenerated.
                      </p>
                    )}
                  </div>

                  {/* Allocations */}
                  <div
                    className={cn(
                      "border-t pt-4",
                      isDark ? "border-zinc-700/50" : "border-zinc-200"
                    )}
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <h3
                        className={cn(
                          "text-sm font-medium tracking-wider uppercase",
                          isDark ? "text-zinc-300" : "text-zinc-700"
                        )}
                      >
                        Allocations ({node.allocations?.length || 0})
                      </h3>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setShowAddAllocation(true)}
                          className={cn(
                            "flex items-center gap-1 text-xs",
                            isDark
                              ? "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                              : "border-zinc-300 text-zinc-600 hover:border-zinc-400"
                          )}
                        >
                          <PlusIcon className="h-3 w-3" />
                          Add
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setShowAddRange(true)}
                          className={cn(
                            "flex items-center gap-1 text-xs",
                            isDark
                              ? "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                              : "border-zinc-300 text-zinc-600 hover:border-zinc-400"
                          )}
                        >
                          <PlusIcon className="h-3 w-3" />
                          Add Range
                        </Button>
                      </div>
                    </div>

                    {/* Allocations list */}
                    <div className="max-h-64 space-y-2 overflow-y-auto">
                      {!node.allocations || node.allocations.length === 0 ? (
                        <p
                          className={cn(
                            "py-4 text-center text-sm",
                            isDark ? "text-zinc-500" : "text-zinc-400"
                          )}
                        >
                          No allocations configured
                        </p>
                      ) : (
                        node.allocations.map((allocation) => (
                          <div
                            key={allocation.id}
                            className={cn(
                              "flex items-center justify-between border p-3",
                              isDark
                                ? "border-zinc-800 bg-zinc-900/50"
                                : "border-zinc-200 bg-zinc-50"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <NetworkIcon
                                className={cn(
                                  "h-4 w-4",
                                  isDark ? "text-zinc-500" : "text-zinc-400"
                                )}
                              />
                              <span
                                className={cn(
                                  "font-mono text-sm",
                                  isDark ? "text-zinc-200" : "text-zinc-700"
                                )}
                              >
                                {allocation.ip}:{allocation.port}
                              </span>
                              {allocation.assigned && (
                                <span
                                  className={cn(
                                    "border px-2 py-0.5 text-[10px] font-medium tracking-wider uppercase",
                                    isDark
                                      ? "border-zinc-600 text-zinc-400"
                                      : "border-zinc-400 text-zinc-600"
                                  )}
                                >
                                  In Use
                                </span>
                              )}
                              {allocation.alias && (
                                <span
                                  className={cn(
                                    "text-xs",
                                    isDark ? "text-zinc-500" : "text-zinc-400"
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
                              disabled={
                                allocation.assigned || deletingAllocationId === allocation.id
                              }
                              onClick={() => handleDeleteAllocation(allocation.id)}
                              className={cn(
                                "h-auto p-1",
                                allocation.assigned
                                  ? "cursor-not-allowed opacity-30"
                                  : isDark
                                    ? "text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
                                    : "text-zinc-400 hover:bg-red-50 hover:text-red-600"
                              )}
                              title={
                                allocation.assigned
                                  ? "Cannot delete assigned allocation"
                                  : "Delete allocation"
                              }
                            >
                              {deletingAllocationId === allocation.id ? (
                                <Spinner className="h-4 w-4" />
                              ) : (
                                <TrashIcon className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Add single allocation form */}
                    {showAddAllocation && (
                      <div
                        className={cn(
                          "mt-4 border p-4",
                          isDark ? "border-zinc-700 bg-zinc-900/50" : "border-zinc-200 bg-zinc-50"
                        )}
                      >
                        <p
                          className={cn(
                            "mb-3 text-sm font-medium",
                            isDark ? "text-zinc-300" : "text-zinc-600"
                          )}
                        >
                          Add Single Allocation
                        </p>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className={labelClasses}>IP Address</label>
                            <input
                              type="text"
                              value={allocationForm.ip}
                              onChange={(e) =>
                                setAllocationForm({ ...allocationForm, ip: e.target.value })
                              }
                              className={inputClasses}
                              placeholder="0.0.0.0"
                              required
                            />
                          </div>
                          <div>
                            <label className={labelClasses}>Port</label>
                            <input
                              type="number"
                              value={allocationForm.port}
                              onChange={(e) =>
                                setAllocationForm({
                                  ...allocationForm,
                                  port: parseInt(e.target.value) || 25565,
                                })
                              }
                              className={inputClasses}
                              min={1}
                              max={65535}
                              required
                            />
                          </div>
                          <div>
                            <label className={labelClasses}>Alias (optional)</label>
                            <input
                              type="text"
                              value={allocationForm.alias}
                              onChange={(e) =>
                                setAllocationForm({ ...allocationForm, alias: e.target.value })
                              }
                              className={inputClasses}
                              placeholder="game1"
                            />
                          </div>
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setShowAddAllocation(false);
                              setAllocationForm({ ip: "", port: 25565, alias: "" });
                            }}
                            className={cn(
                              "text-xs",
                              isDark
                                ? "border-zinc-700 text-zinc-400"
                                : "border-zinc-300 text-zinc-600"
                            )}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={!allocationForm.ip || addAllocation.isPending}
                            onClick={handleAddAllocation}
                            className={cn(
                              "text-xs",
                              isDark
                                ? "bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
                                : "bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
                            )}
                          >
                            {addAllocation.isPending ? <Spinner className="h-3 w-3" /> : "Add"}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Add range form */}
                    {showAddRange && (
                      <div
                        className={cn(
                          "mt-4 border p-4",
                          isDark ? "border-zinc-700 bg-zinc-900/50" : "border-zinc-200 bg-zinc-50"
                        )}
                      >
                        <p
                          className={cn(
                            "mb-3 text-sm font-medium",
                            isDark ? "text-zinc-300" : "text-zinc-600"
                          )}
                        >
                          Add Allocation Range
                        </p>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className={labelClasses}>IP Address</label>
                            <input
                              type="text"
                              value={rangeForm.ip}
                              onChange={(e) => setRangeForm({ ...rangeForm, ip: e.target.value })}
                              className={inputClasses}
                              placeholder="0.0.0.0"
                              required
                            />
                          </div>
                          <div>
                            <label className={labelClasses}>Start Port</label>
                            <input
                              type="number"
                              value={rangeForm.startPort}
                              onChange={(e) =>
                                setRangeForm({
                                  ...rangeForm,
                                  startPort: parseInt(e.target.value) || 25565,
                                })
                              }
                              className={inputClasses}
                              min={1}
                              max={65535}
                              required
                            />
                          </div>
                          <div>
                            <label className={labelClasses}>End Port</label>
                            <input
                              type="number"
                              value={rangeForm.endPort}
                              onChange={(e) =>
                                setRangeForm({
                                  ...rangeForm,
                                  endPort: parseInt(e.target.value) || 25575,
                                })
                              }
                              className={inputClasses}
                              min={1}
                              max={65535}
                              required
                            />
                          </div>
                        </div>
                        <p
                          className={cn("mt-2 text-xs", isDark ? "text-zinc-500" : "text-zinc-400")}
                        >
                          This will create{" "}
                          {Math.max(0, rangeForm.endPort - rangeForm.startPort + 1)} allocations
                        </p>
                        <div className="mt-3 flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setShowAddRange(false);
                              setRangeForm({ ip: "", startPort: 25565, endPort: 25575 });
                            }}
                            className={cn(
                              "text-xs",
                              isDark
                                ? "border-zinc-700 text-zinc-400"
                                : "border-zinc-300 text-zinc-600"
                            )}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={!rangeForm.ip || addAllocationRange.isPending}
                            onClick={handleAddRange}
                            className={cn(
                              "text-xs",
                              isDark
                                ? "bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
                                : "bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
                            )}
                          >
                            {addAllocationRange.isPending ? (
                              <Spinner className="h-3 w-3" />
                            ) : (
                              "Add Range"
                            )}
                          </Button>
                        </div>
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
                  onClick={() => router.push("/admin/nodes")}
                  className={cn(
                    "text-xs tracking-wider uppercase transition-all hover:scale-[1.02] active:scale-95",
                    isDark ? "border-zinc-700 text-zinc-400" : "border-zinc-300 text-zinc-600"
                  )}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={update.isPending}
                  className={cn(
                    "flex items-center gap-2 text-xs tracking-wider uppercase transition-all hover:scale-[1.02] active:scale-95",
                    isDark
                      ? "bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
                      : "bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
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

      {/* Regenerate Token Confirmation */}
      <ConfirmationModal
        open={showRegenerateConfirm}
        onOpenChange={setShowRegenerateConfirm}
        onConfirm={handleRegenerateToken}
        title="Regenerate Token"
        description="This will invalidate the current daemon token. The daemon will need to be reconfigured with the new token. This action cannot be undone."
        confirmLabel={regenerateToken.isPending ? "Regenerating..." : "Regenerate"}
        variant="danger"
        isLoading={regenerateToken.isPending}
      />
    </div>
  );
}

"use client";

import {useEffect, useState} from "react";
import {useParams, useRouter} from "next/navigation";
import {cn} from "@workspace/ui/lib/utils";
import {TextureButton} from "@workspace/ui/components/texture-button";
import {Spinner} from "@workspace/ui/components/spinner";
import {AnimatedBackground} from "@workspace/ui/components/animated-background";
import {FadeIn} from "@workspace/ui/components/fade-in";
import {ConfirmationModal} from "@workspace/ui/components/confirmation-modal";
import {ArrowLeftIcon, KeyIcon, NetworkIcon, PlusIcon, SaveIcon, TrashIcon} from "lucide-react";
import {useNode, useNodeMutations} from "@/hooks/queries";
import {toast} from "sonner";
import {Input} from "@workspace/ui/components";
import {Label} from "@workspace/ui/components/label";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue,} from "@workspace/ui/components/select";

export default function EditNodePage() {
  const router = useRouter();
  const params = useParams();
  const nodeId = params.id as string;

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

  const bytesToMiB = (bytes: number) => bytes / (1024 * 1024);
  const miBToBytes = (mib: number) => Math.floor(mib * (1024 * 1024));
  const formatMiB = (mib: number) => `${Math.floor(mib)} MiB`;

  if (isLoading) {
    return (
      <div className={cn("relative flex min-h-svh items-center justify-center bg-[#0b0b0a]")}>
        <AnimatedBackground />
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (!node) {
    return (
      <div className={cn("relative flex min-h-svh items-center justify-center bg-[#0b0b0a]")}>
        <AnimatedBackground />
        <p className={"text-zinc-400"}>Node not found</p>
      </div>
    );
  }

  return (
    <div className={cn("relative min-h-svh bg-[#0b0b0a] transition-colors")}>
      <AnimatedBackground />

      <div className="relative p-8">
        <div className="mx-auto max-w-3xl">
          <FadeIn delay={0}>
            {/* Header */}
            <div className="mb-8 flex items-center gap-4">
              <TextureButton variant="minimal" onClick={() => router.push("/admin/nodes")}>
                <ArrowLeftIcon className="h-4 w-4" />
              </TextureButton>
              <div>
                <h1 className={cn("text-2xl font-light tracking-wider text-zinc-100")}>
                  EDIT NODE
                </h1>
                <p className={cn("mt-1 text-sm text-zinc-500")}>
                  {node.displayName} - {node.host}:{node.port}
                </p>
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={0.1}>
            <form onSubmit={handleSubmit}>
              <div
                className={cn(
                  "relative border border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] p-6 shadow-lg shadow-black/20"
                )}
              >
                <div className="space-y-4">
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
                  <div className={cn("border-t border-zinc-700/50 pt-4")}>
                    <h3
                      className={cn(
                        "mb-4 text-sm font-medium tracking-wider text-zinc-300 uppercase"
                      )}
                    >
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
                        <p className={cn("mt-1 text-xs text-zinc-600")}>
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
                        <p className={cn("mt-1 text-xs text-zinc-600")}>
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
                            setFormData({ ...formData, cpuLimit: parseFloat(e.target.value) || 1 })
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
                        <p className={cn("mt-1 text-xs text-zinc-600")}>
                          {formatMiB(bytesToMiB(formData.uploadLimit))}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Token Management */}
                  <div className={cn("border-t border-zinc-700/50 pt-4")}>
                    <div className="mb-4 flex items-center justify-between">
                      <h3
                        className={cn("text-sm font-medium tracking-wider text-zinc-300 uppercase")}
                      >
                        Daemon Token
                      </h3>
                      <TextureButton
                        type="button"
                        variant="minimal"
                        onClick={() => setShowRegenerateConfirm(true)}
                      >
                        <KeyIcon className="h-3 w-3" />
                        Regenerate
                      </TextureButton>
                    </div>
                    {newToken && (
                      <div
                        className={cn(
                          "flex flex-col justify-between gap-2 border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs break-all text-zinc-300"
                        )}
                      >
                        <span className="flex-1">TOKENID: {newToken.token_id}</span>
                        <span>TOKEN: {newToken.token}</span>
                      </div>
                    )}
                    {!newToken && (
                      <p className={cn("text-xs text-zinc-500")}>
                        Token is only shown once when created or regenerated.
                      </p>
                    )}
                  </div>

                  {/* Allocations */}
                  <div className={cn("border-t border-zinc-700/50 pt-4")}>
                    <div className="mb-4 flex items-center justify-between">
                      <h3
                        className={cn("text-sm font-medium tracking-wider text-zinc-300 uppercase")}
                      >
                        Allocations ({node.allocations?.length || 0})
                      </h3>
                      <div className="flex items-center gap-2">
                        <TextureButton
                          type="button"
                          variant="minimal"
                          onClick={() => setShowAddAllocation(true)}
                        >
                          <PlusIcon className="h-3 w-3" />
                          Add
                        </TextureButton>
                        <TextureButton
                          type="button"
                          variant="minimal"
                          onClick={() => setShowAddRange(true)}
                        >
                          <PlusIcon className="h-3 w-3" />
                          Add Range
                        </TextureButton>
                      </div>
                    </div>

                    {/* Allocations list */}
                    <div className="max-h-64 space-y-2 overflow-y-auto">
                      {!node.allocations || node.allocations.length === 0 ? (
                        <p className={cn("py-4 text-center text-sm text-zinc-500")}>
                          No allocations configured
                        </p>
                      ) : (
                        node.allocations.map((allocation) => (
                          <div
                            key={allocation.id}
                            className={cn(
                              "flex items-center justify-between border border-zinc-800 bg-zinc-900/50 p-3"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <NetworkIcon className={cn("h-4 w-4 text-zinc-500")} />
                              <span className={cn("font-mono text-sm text-zinc-200")}>
                                {allocation.ip}:{allocation.port}
                              </span>
                              {allocation.assigned && (
                                <span
                                  className={cn(
                                    "border border-zinc-600 px-2 py-0.5 text-[10px] font-medium tracking-wider text-zinc-400 uppercase"
                                  )}
                                >
                                  In Use
                                </span>
                              )}
                              {allocation.alias && (
                                <span className={cn("text-xs text-zinc-500")}>
                                  ({allocation.alias})
                                </span>
                              )}
                            </div>
                            <TextureButton
                              type="button"
                              variant="minimal"
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
                                <TrashIcon className="h-4 w-4" />
                              )}
                            </TextureButton>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Add single allocation form */}
                    {showAddAllocation && (
                      <div className={cn("mt-4 border border-zinc-700 bg-zinc-900/50 p-4")}>
                        <p className={cn("mb-3 text-sm font-medium text-zinc-300")}>
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
                            onClick={() => {
                              setShowAddAllocation(false);
                              setAllocationForm({ ip: "", port: 25565, alias: "" });
                            }}
                          >
                            Cancel
                          </TextureButton>
                          <TextureButton
                            type="button"
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
                      <div className={cn("mt-4 border border-zinc-700 bg-zinc-900/50 p-4")}>
                        <p className={cn("mb-3 text-sm font-medium text-zinc-300")}>
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
                        <p className={cn("mt-2 text-xs text-zinc-500")}>
                          This will create{" "}
                          {Math.max(0, rangeForm.endPort - rangeForm.startPort + 1)} allocations
                        </p>
                        <div className="mt-3 flex items-center gap-2">
                          <TextureButton
                            type="button"
                            variant="minimal"
                            onClick={() => {
                              setShowAddRange(false);
                              setRangeForm({ ip: "", startPort: 25565, endPort: 25575 });
                            }}
                          >
                            Cancel
                          </TextureButton>
                          <TextureButton
                            type="button"
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

              {/* Submit Button */}
              <div className="mt-6 flex justify-end gap-3">
                <TextureButton
                  type="button"
                  variant="minimal"
                  onClick={() => router.push("/admin/nodes")}
                >
                  Cancel
                </TextureButton>
                <TextureButton variant="minimal" type="submit" disabled={update.isPending}>
                  {update.isPending ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    <SaveIcon className="h-4 w-4" />
                  )}
                  {update.isPending ? "Saving..." : "Save Changes"}
                </TextureButton>
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

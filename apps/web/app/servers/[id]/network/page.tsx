"use client";

import { type JSX, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { cn } from "@workspace/ui/lib/utils";
import { TextureButton } from "@workspace/ui/components/texture-button";
import { Input } from "@workspace/ui/components/input";
import { SidebarTrigger } from "@workspace/ui/components/sidebar";
import { Switch } from "@workspace/ui/components/switch";
import { ConfirmationModal } from "@workspace/ui/components/confirmation-modal";
import { FormModal } from "@workspace/ui/components/form-modal";
import { BsGlobe, BsHddNetwork, BsKey, BsPlus, BsStar, BsStarFill, BsTrash } from "react-icons/bs";
import { useServer } from "components/ServerStatusPages/server-provider";
import { ServerInstallingPlaceholder } from "components/ServerStatusPages/server-installing-placeholder";
import { ServerSuspendedPlaceholder } from "components/ServerStatusPages/server-suspended-placeholder";
import { type Allocation, features, servers, type SubdomainFeatureStatus } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { Label } from "@workspace/ui/components/label";

interface Subdomain {
  id: string;
  subdomain: string;
  domain: string;
  targetPort: number;
  ssl: boolean;
}

const NetworkPage = (): JSX.Element | null => {
  const params = useParams();
  const serverId = params.id as string;
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [subdomains, setSubdomains] = useState<Subdomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [settingPrimary, setSettingPrimary] = useState<string | null>(null);
  const [subdomainFeature, setSubdomainFeature] = useState<SubdomainFeatureStatus | null>(null);

  // Get server data for SFTP details and primary allocation
  const { server, consoleInfo, isInstalling, refetch } = useServer();

  // Get user session for SFTP username
  const { data: session } = useSession();

  // Modal states
  const [deletePortModalOpen, setDeletePortModalOpen] = useState(false);
  const [addAllocationModalOpen, setAddAllocationModalOpen] = useState(false);
  const [addSubdomainModalOpen, setAddSubdomainModalOpen] = useState(false);
  const [deleteSubdomainModalOpen, setDeleteSubdomainModalOpen] = useState(false);
  const [selectedAllocation, setSelectedAllocation] = useState<Allocation | null>(null);
  const [selectedSubdomain, setSelectedSubdomain] = useState<Subdomain | null>(null);
  const [availableAllocations, setAvailableAllocations] = useState<Allocation[]>([]);
  const [selectedNewAllocation, setSelectedNewAllocation] = useState<string | null>(null);
  const [addingAllocation, setAddingAllocation] = useState(false);

  // Subdomain form states
  const [subdomainName, setSubdomainName] = useState("");
  const [subdomainTargetPort, setSubdomainTargetPort] = useState<string>("");
  const [subdomainSsl, setSubdomainSsl] = useState(true);

  // Fetch allocations and subdomain feature status
  useEffect(() => {
    if (serverId) {
      fetchAllocations();
      fetchSubdomainFeature();
    }
  }, [serverId]);

  const fetchSubdomainFeature = async () => {
    try {
      const status = await features.subdomains();
      setSubdomainFeature(status);
    } catch (error) {
      console.error("Failed to fetch subdomain feature status:", error);
      setSubdomainFeature({ enabled: false, baseDomain: null, dnsProvider: "manual" });
    }
  };

  const fetchAllocations = async () => {
    try {
      setLoading(true);
      const data = await servers.allocations.list(serverId);
      setAllocations(data);
    } catch (error) {
      console.error("Failed to fetch allocations:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableAllocations = async () => {
    try {
      const data = await servers.allocations.available(serverId);
      setAvailableAllocations(data);
    } catch (error) {
      console.error("Failed to fetch available allocations:", error);
    }
  };

  const openAddAllocationModal = async () => {
    setSelectedNewAllocation(null);
    await fetchAvailableAllocations();
    setAddAllocationModalOpen(true);
  };

  const handleAddAllocation = async () => {
    if (!selectedNewAllocation) return;
    try {
      setAddingAllocation(true);
      await servers.allocations.add(serverId, selectedNewAllocation);
      await fetchAllocations();
      await refetch();
      setAddAllocationModalOpen(false);
      setSelectedNewAllocation(null);
    } catch (error) {
      console.error("Failed to add allocation:", error);
    } finally {
      setAddingAllocation(false);
    }
  };

  if (isInstalling) {
    return (
      <div className="min-h-svh">
        {/* Background is now rendered in the layout for persistence */}
        <ServerInstallingPlaceholder serverName={server?.name} />
      </div>
    );
  }

  if (server?.status === "SUSPENDED") {
    return (
      <div className="min-h-svh">
        <ServerSuspendedPlaceholder serverName={server?.name} />
      </div>
    );
  }

  const resetSubdomainForm = () => {
    setSubdomainName("");
    setSubdomainTargetPort("");
    setSubdomainSsl(true);
  };

  const openDeletePortModal = (allocation: Allocation) => {
    setSelectedAllocation(allocation);
    setDeletePortModalOpen(true);
  };

  const openAddSubdomainModal = () => {
    resetSubdomainForm();
    // Default to primary allocation or first allocation
    const defaultAllocation =
      allocations.find((a) => a.id === server?.primaryAllocationId) || allocations[0];
    if (defaultAllocation) {
      setSubdomainTargetPort(defaultAllocation.port.toString());
    }
    setAddSubdomainModalOpen(true);
  };

  const openDeleteSubdomainModal = (sub: Subdomain) => {
    setSelectedSubdomain(sub);
    setDeleteSubdomainModalOpen(true);
  };

  const handleDeletePort = async () => {
    if (!selectedAllocation) return;
    try {
      await servers.allocations.remove(serverId, selectedAllocation.id);
      await fetchAllocations();
      setDeletePortModalOpen(false);
      setSelectedAllocation(null);
    } catch (error) {
      console.error("Failed to delete allocation:", error);
    }
  };

  const handleSetPrimary = async (allocation: Allocation) => {
    if (allocation.id === server?.primaryAllocationId) return;

    try {
      setSettingPrimary(allocation.id);
      await servers.allocations.setPrimary(serverId, allocation.id);
      await refetch();
    } catch (error) {
      console.error("Failed to set primary allocation:", error);
    } finally {
      setSettingPrimary(null);
    }
  };

  const handleAddSubdomain = () => {
    const selectedPortNumber = subdomainTargetPort
      ? parseInt(subdomainTargetPort)
      : allocations[0]?.port || 0;
    const newSubdomain: Subdomain = {
      id: `sub-${Date.now()}`,
      subdomain: subdomainName.toLowerCase(),
      domain: "stellarstack.app",
      targetPort: selectedPortNumber,
      ssl: subdomainSsl,
    };
    setSubdomains((prev) => [...prev, newSubdomain]);
    setAddSubdomainModalOpen(false);
    resetSubdomainForm();
  };

  const handleDeleteSubdomain = () => {
    if (!selectedSubdomain) return;
    setSubdomains((prev) => prev.filter((s) => s.id !== selectedSubdomain.id));
    setDeleteSubdomainModalOpen(false);
    setSelectedSubdomain(null);
  };

  const isSubdomainValid = subdomainName.trim() !== "" && allocations.length > 0;
  const isPrimary = (allocation: Allocation) => allocation.id === server?.primaryAllocationId;

  // Allocation limit
  const allocationLimit = server?.allocationLimit ?? 1;
  const allocationsRemaining = allocationLimit - allocations.length;
  const canAddAllocation = allocationsRemaining > 0;

  return (
    <div className="relative min-h-full transition-colors">
      {/* Background is now rendered in the layout for persistence */}

      <div className="relative p-8">
        <div className="mx-auto">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <SidebarTrigger
                className={cn(
                  "transition-all hover:scale-110 active:scale-95",
                  "text-zinc-400 hover:text-zinc-100"
                )}
              />
            </div>
          </div>

          {/* Port Allocations Section */}
          <div className="mb-8">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <BsHddNetwork className={cn("h-5 w-5", "text-zinc-400")} />
                  <h2
                    className={cn("text-sm font-medium tracking-wider uppercase", "text-zinc-300")}
                  >
                    Port Allocations
                  </h2>
                </div>
                <span className={cn("text-xs", "text-zinc-500")}>
                  {allocations.length} / {allocationLimit} used
                </span>
              </div>
              <TextureButton
                variant="primary"
                onClick={openAddAllocationModal}
                disabled={!canAddAllocation}
                title={canAddAllocation ? "Add a new allocation" : "Allocation limit reached"}
              >
                <BsPlus className="h-4 w-4" />
                <span className="text-xs tracking-wider uppercase">Add Allocation</span>
              </TextureButton>
            </div>

            {loading ? (
              <div className={cn("border p-8 text-center", "border-zinc-800 text-zinc-500")}>
                Loading allocations...
              </div>
            ) : allocations.length === 0 ? (
              <div className={cn("border p-8 text-center", "border-zinc-800 text-zinc-500")}>
                No allocations assigned to this server.
              </div>
            ) : (
              <div className="space-y-3">
                {allocations.map((allocation) => (
                  <div
                    key={allocation.id}
                    className={cn(
                      "relative border border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] p-4 transition-all"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={cn("font-mono text-lg font-medium", "text-zinc-100")}>
                          {allocation.ip}:{allocation.port}
                        </div>
                        <div className="flex items-center gap-2">
                          {isPrimary(allocation) && (
                            <span
                              className={cn(
                                "border px-2 py-0.5 text-[10px] font-medium tracking-wider uppercase",
                                "border-green-500/50 text-green-400"
                              )}
                            >
                              Primary
                            </span>
                          )}
                          {allocation.alias && (
                            <span className={cn("text-sm", "text-zinc-500")}>
                              {allocation.alias}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!isPrimary(allocation) && (
                          <TextureButton
                            variant="minimal"
                            size="sm"
                            disabled={settingPrimary === allocation.id}
                            onClick={() => handleSetPrimary(allocation)}
                            title="Set as primary"
                          >
                            {settingPrimary === allocation.id ? (
                              <span className="h-4 w-4 animate-spin">⏳</span>
                            ) : (
                              <BsStar className="h-4 w-4" />
                            )}
                          </TextureButton>
                        )}
                        {isPrimary(allocation) && (
                          <div className={cn("p-2", "text-yellow-400")}>
                            <BsStarFill className="h-4 w-4" />
                          </div>
                        )}
                        <TextureButton
                          variant="minimal"
                          size="sm"
                          disabled={isPrimary(allocation) || allocations.length <= 1}
                          onClick={() => openDeletePortModal(allocation)}
                        >
                          <BsTrash className="h-4 w-4" />
                        </TextureButton>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Subdomains Section - Only show if feature is enabled */}
          {subdomainFeature?.enabled && (
            <div className="mb-8">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BsGlobe className={cn("h-5 w-5", "text-zinc-400")} />
                  <h2
                    className={cn("text-sm font-medium tracking-wider uppercase", "text-zinc-300")}
                  >
                    Subdomains
                  </h2>
                </div>
                <TextureButton variant="minimal" size="sm" onClick={openAddSubdomainModal}>
                  <BsPlus className="h-4 w-4" />
                  <span className="text-xs tracking-wider uppercase">Add Subdomain</span>
                </TextureButton>
              </div>

              {subdomains.length === 0 ? (
                <div className={cn("border p-8 text-center", "border-zinc-800 text-zinc-500")}>
                  No subdomains configured. Add a subdomain to create a friendly URL for your
                  server.
                </div>
              ) : (
                <div className="space-y-3">
                  {subdomains.map((sub) => (
                    <div
                      key={sub.id}
                      className={cn(
                        "relative border p-4 transition-all",
                        "border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a]"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={cn("font-mono text-sm", "text-zinc-100")}>
                            {sub.subdomain}.{sub.domain}
                          </div>
                          <div className="flex items-center gap-2">
                            {sub.ssl && (
                              <span
                                className={cn(
                                  "border px-2 py-0.5 text-[10px] font-medium tracking-wider uppercase",
                                  "border-green-500/50 text-green-400"
                                )}
                              >
                                SSL
                              </span>
                            )}
                          </div>
                          <span className={cn("text-sm", "text-zinc-500")}>
                            → Port {sub.targetPort}
                          </span>
                        </div>
                        <TextureButton
                          variant="minimal"
                          size="sm"
                          onClick={() => openDeleteSubdomainModal(sub)}
                        >
                          <BsTrash className="h-4 w-4" />
                        </TextureButton>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SFTP Connection Details Section */}
          <div className="mb-8">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BsKey className={cn("h-5 w-5", "text-zinc-400")} />
                <h2 className={cn("text-sm font-medium tracking-wider uppercase", "text-zinc-300")}>
                  SFTP Connection
                </h2>
              </div>
            </div>

            <div
              className={cn(
                "relative border p-6 transition-all",
                "border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a]"
              )}
            >
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <div>
                  <Label>Host</Label>
                  <div className={cn("font-mono text-sm", "text-zinc-100")}>
                    {server?.node?.host || <span className="text-zinc-600">Loading...</span>}
                  </div>
                </div>

                <div>
                  <Label>Port</Label>
                  <div className={cn("font-mono text-sm", "text-zinc-100")}>
                    {server?.node?.sftpPort ?? 2022}
                  </div>
                </div>

                <div>
                  <Label>Username</Label>
                  <div className={cn("font-mono text-sm break-all", "text-zinc-100")}>
                    {server && session?.user ? (
                      `${server.id}.${session.user.email}`
                    ) : (
                      <span className="text-zinc-600">Loading...</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <TextureButton
                  variant="minimal"
                  onClick={() => {
                    if (!server || !session?.user) return;
                    const host = server.node?.host || "localhost";
                    const port = server.node?.sftpPort || 2022;
                    const username = `${server.id}.${session.user.email}`;
                    // Try to open SFTP URL - this will work if user has an SFTP handler installed
                    window.open(`sftp://${username}@${host}:${port}`, "_blank");
                  }}
                  disabled={!server || !session?.user}
                >
                  <BsKey className="h-4 w-4" />
                  <span className="text-xs tracking-wider uppercase">Connect via SFTP</span>
                </TextureButton>

                <TextureButton
                  variant="minimal"
                  onClick={() => {
                    if (!server || !session?.user) return;
                    const host = server.node?.host || "localhost";
                    const port = server.node?.sftpPort || 2022;
                    const username = `${server.id}.${session.user.email}`;
                    navigator.clipboard.writeText(`sftp://${username}@${host}:${port}`);
                  }}
                  disabled={!server || !session?.user}
                >
                  <span className="text-xs tracking-wider uppercase">Copy Connection URL</span>
                </TextureButton>
              </div>

              <p className={cn("mt-4 text-xs", "text-zinc-600")}>
                Use your account password to authenticate via SFTP.
              </p>
            </div>
          </div>
        </div>
      </div>

      <ConfirmationModal
        open={deletePortModalOpen}
        onOpenChange={setDeletePortModalOpen}
        title="Remove Allocation"
        description={`Are you sure you want to remove ${selectedAllocation?.ip}:${selectedAllocation?.port}? Services using this allocation will no longer be accessible.`}
        onConfirm={handleDeletePort}
        confirmLabel="Remove"
      />

      {/* Add Subdomain Modal */}
      <FormModal
        open={addSubdomainModalOpen}
        onOpenChange={setAddSubdomainModalOpen}
        title="Add Subdomain"
        description="Create a subdomain pointing to your server."
        onSubmit={handleAddSubdomain}
        submitLabel="Add Subdomain"
        isValid={isSubdomainValid}
      >
        <div className="space-y-4">
          <div>
            <Label>Subdomain Name</Label>
            <div className="flex items-center gap-2">
              <Input
                value={subdomainName}
                onChange={(e) => setSubdomainName(e.target.value)}
                placeholder="e.g., play"
                className={cn(
                  "transition-all",
                  "border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-600"
                )}
              />
              <span className={cn("shrink-0 text-sm", "text-zinc-500")}>.stellarstack.app</span>
            </div>
          </div>
          <div>
            <Label>Target Port</Label>
            {allocations.length > 0 ? (
              <div className="grid grid-cols-1 gap-2">
                {allocations.map((allocation) => (
                  <TextureButton
                    variant="minimal"
                    key={allocation.id}
                    type="button"
                    onClick={() => setSubdomainTargetPort(allocation.port.toString())}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm">
                          {allocation.ip}:{allocation.port}
                        </span>
                        {isPrimary(allocation) && (
                          <span
                            className={cn(
                              "border px-2 py-0.5 text-[10px] font-medium tracking-wider uppercase",
                              "border-green-500/50 text-green-400"
                            )}
                          >
                            Primary
                          </span>
                        )}
                      </div>
                      {allocation.alias && (
                        <span className={cn("text-xs", "text-zinc-500")}>{allocation.alias}</span>
                      )}
                    </div>
                  </TextureButton>
                ))}
              </div>
            ) : (
              <div className={cn("border p-4 text-center", "border-zinc-700 bg-zinc-800/50")}>
                <p className={cn("text-sm", "text-zinc-400")}>No allocations available.</p>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between">
            <Label>Enable SSL</Label>
            <Switch checked={subdomainSsl} onCheckedChange={setSubdomainSsl} />
          </div>
        </div>
      </FormModal>

      {/* Delete Subdomain Modal */}
      <ConfirmationModal
        open={deleteSubdomainModalOpen}
        onOpenChange={setDeleteSubdomainModalOpen}
        title="Delete Subdomain"
        description={`Are you sure you want to delete ${selectedSubdomain?.subdomain}.${selectedSubdomain?.domain}? The subdomain will no longer resolve.`}
        onConfirm={handleDeleteSubdomain}
        confirmLabel="Delete"
      />

      {/* Add Allocation Modal */}
      <FormModal
        open={addAllocationModalOpen}
        onOpenChange={setAddAllocationModalOpen}
        title="Add Allocation"
        description={`Add a new port allocation to your server. ${allocationsRemaining} remaining.`}
        onSubmit={handleAddAllocation}
        submitLabel={addingAllocation ? "Adding..." : "Add Allocation"}
        isValid={!!selectedNewAllocation && !addingAllocation}
        isLoading={addingAllocation}
      >
        <div className="space-y-4">
          <div>
            <Label>Available Allocations</Label>
            {availableAllocations.length > 0 ? (
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {availableAllocations.map((allocation) => (
                  <TextureButton
                    variant="minimal"
                    key={allocation.id}
                    type="button"
                    onClick={() => setSelectedNewAllocation(allocation.id)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm">
                        {allocation.ip}:{allocation.port}
                      </span>
                      {allocation.alias && (
                        <span className={cn("text-xs", "text-zinc-500")}>{allocation.alias}</span>
                      )}
                    </div>
                  </TextureButton>
                ))}
              </div>
            ) : (
              <div className={cn("border p-4 text-center", "border-zinc-700 bg-zinc-800/50")}>
                <p className={cn("text-sm", "text-zinc-400")}>
                  No available allocations on this node.
                </p>
              </div>
            )}
          </div>
        </div>
      </FormModal>
    </div>
  );
};

export default NetworkPage;

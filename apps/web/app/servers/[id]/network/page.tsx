"use client";

import { type JSX, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { cn } from "@stellarUI/lib/utils";
import { TextureButton } from "@stellarUI/components/TextureButton";
import Input from "@stellarUI/components/Input/Input";
import { SidebarTrigger } from "@stellarUI/components/Sidebar/Sidebar";
import Switch from "@stellarUI/components/Switch/Switch";
import ConfirmationModal from "@stellarUI/components/ConfirmationModal/ConfirmationModal";
import FormModal from "@stellarUI/components/FormModal/FormModal";
import { FadeIn } from "@stellarUI/components/FadeIn/FadeIn";
import Spinner from "@stellarUI/components/Spinner/Spinner";
import { BsGlobe, BsHddNetwork, BsKey, BsPlus, BsStar, BsStarFill, BsTrash } from "react-icons/bs";
import { useServer } from "components/ServerStatusPages/server-provider/server-provider";
import { ServerInstallingPlaceholder } from "components/ServerStatusPages/server-installing-placeholder/server-installing-placeholder";
import { ServerSuspendedPlaceholder } from "components/ServerStatusPages/server-suspended-placeholder/server-suspended-placeholder";
import { type Allocation, features, servers, type SubdomainFeatureStatus } from "@/lib/api";
import { useAuth } from "hooks/auth-provider";
import Label from "@stellarUI/components/Label/Label";

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

  // Get user for SFTP username
  const { user } = useAuth();

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
    <FadeIn className="flex min-h-[calc(100svh-1rem)] w-full flex-col">
      <div className="relative flex min-h-[calc(100svh-1rem)] w-full flex-col transition-colors">
        <div className="relative flex min-h-[calc(100svh-1rem)] w-full flex-col rounded-lg bg-black px-4 pb-4">
          {/* Header */}
          <FadeIn delay={0}>
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <SidebarTrigger
                  className={cn(
                    "text-zinc-400 transition-all hover:scale-110 hover:text-zinc-100 active:scale-95"
                  )}
                />
              </div>
              <div className="flex items-center gap-2">
                <TextureButton
                  variant="primary"
                  size="sm"
                  className="w-fit"
                  onClick={openAddAllocationModal}
                  disabled={!canAddAllocation}
                  title={canAddAllocation ? "Add a new allocation" : "Allocation limit reached"}
                >
                  <BsPlus className="h-4 w-4" />
                  Add Allocation
                </TextureButton>
              </div>
            </div>
          </FadeIn>

          <div className="space-y-4">
            {/* Port Allocations Card */}
            <FadeIn delay={0.05}>
              <div className="flex h-full flex-col rounded-lg border border-white/5 bg-[#090909] p-1 pt-2">
                <div className="flex shrink-0 items-center justify-between pr-2 pb-2 pl-2">
                  <div className="flex items-center gap-2 text-xs opacity-50">
                    <BsHddNetwork className="h-3 w-3" />
                    Port Allocations
                  </div>
                  <span className="text-xs text-zinc-500">
                    {allocations.length} / {allocationLimit} used
                  </span>
                </div>
                <div className="flex flex-1 flex-col rounded-lg border border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] shadow-lg shadow-black/20">
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <Spinner />
                    </div>
                  ) : allocations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <BsHddNetwork className="mb-4 h-12 w-12 text-zinc-600" />
                      <h3 className="mb-2 text-sm font-medium text-zinc-300">No Allocations</h3>
                      <p className="mb-4 text-xs text-zinc-500">
                        No port allocations assigned to this server.
                      </p>
                      <TextureButton
                        variant="minimal"
                        size="sm"
                        className="w-fit"
                        onClick={openAddAllocationModal}
                      >
                        <BsPlus className="h-4 w-4" />
                        Add Allocation
                      </TextureButton>
                    </div>
                  ) : (
                    allocations.map((allocation, index) => (
                      <div
                        key={allocation.id}
                        className={cn(
                          "flex items-center justify-between p-4 transition-colors hover:bg-zinc-800/20",
                          index !== allocations.length - 1 && "border-b border-zinc-800/50"
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <div className="font-mono text-lg font-medium text-zinc-100">
                            {allocation.ip}:{allocation.port}
                          </div>
                          <div className="flex items-center gap-2">
                            {isPrimary(allocation) && (
                              <span className="rounded border border-green-500/50 px-2 py-0.5 text-[10px] font-medium tracking-wider text-green-400 uppercase">
                                Primary
                              </span>
                            )}
                            {allocation.alias && (
                              <span className="text-sm text-zinc-500">{allocation.alias}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {!isPrimary(allocation) && (
                            <TextureButton
                              variant="minimal"
                              size="sm"
                              className="w-fit"
                              disabled={settingPrimary === allocation.id}
                              onClick={() => handleSetPrimary(allocation)}
                              title="Set as primary"
                            >
                              {settingPrimary === allocation.id ? (
                                <Spinner className="h-4 w-4" />
                              ) : (
                                <BsStar className="h-4 w-4" />
                              )}
                            </TextureButton>
                          )}
                          {isPrimary(allocation) && (
                            <div className="p-2 text-yellow-400">
                              <BsStarFill className="h-4 w-4" />
                            </div>
                          )}
                          <TextureButton
                            variant="minimal"
                            size="sm"
                            className="w-fit"
                            disabled={isPrimary(allocation) || allocations.length <= 1}
                            onClick={() => openDeletePortModal(allocation)}
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

            {/* Subdomains Card - Only show if feature is enabled */}
            {subdomainFeature?.enabled && (
              <FadeIn delay={0.1}>
                <div className="flex h-full flex-col rounded-lg border border-white/5 bg-[#090909] p-1 pt-2">
                  <div className="flex shrink-0 items-center justify-between pr-2 pb-2 pl-2">
                    <div className="flex items-center gap-2 text-xs opacity-50">
                      <BsGlobe className="h-3 w-3" />
                      Subdomains
                    </div>
                    <TextureButton
                      variant="minimal"
                      size="sm"
                      className="w-fit"
                      onClick={openAddSubdomainModal}
                    >
                      <BsPlus className="h-4 w-4" />
                      Add
                    </TextureButton>
                  </div>
                  <div className="flex flex-1 flex-col rounded-lg border border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] shadow-lg shadow-black/20">
                    {subdomains.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <BsGlobe className="mb-4 h-12 w-12 text-zinc-600" />
                        <h3 className="mb-2 text-sm font-medium text-zinc-300">No Subdomains</h3>
                        <p className="mb-4 text-center text-xs text-zinc-500">
                          Add a subdomain to create a friendly URL for your server.
                        </p>
                        <TextureButton
                          variant="minimal"
                          size="sm"
                          className="w-fit"
                          onClick={openAddSubdomainModal}
                        >
                          <BsPlus className="h-4 w-4" />
                          Add Subdomain
                        </TextureButton>
                      </div>
                    ) : (
                      subdomains.map((sub, index) => (
                        <div
                          key={sub.id}
                          className={cn(
                            "flex items-center justify-between p-4 transition-colors hover:bg-zinc-800/20",
                            index !== subdomains.length - 1 && "border-b border-zinc-800/50"
                          )}
                        >
                          <div className="flex items-center gap-4">
                            <div className="font-mono text-sm text-zinc-100">
                              {sub.subdomain}.{sub.domain}
                            </div>
                            <div className="flex items-center gap-2">
                              {sub.ssl && (
                                <span className="rounded border border-green-500/50 px-2 py-0.5 text-[10px] font-medium tracking-wider text-green-400 uppercase">
                                  SSL
                                </span>
                              )}
                            </div>
                            <span className="text-sm text-zinc-500">→ Port {sub.targetPort}</span>
                          </div>
                          <TextureButton
                            variant="minimal"
                            size="sm"
                            className="w-fit"
                            onClick={() => openDeleteSubdomainModal(sub)}
                          >
                            <BsTrash className="h-4 w-4" />
                          </TextureButton>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </FadeIn>
            )}

            {/* SFTP Connection Card */}
            <FadeIn delay={subdomainFeature?.enabled ? 0.15 : 0.1}>
              <div className="flex h-full flex-col rounded-lg border border-white/5 bg-[#090909] p-1 pt-2">
                <div className="flex shrink-0 items-center gap-2 pb-2 pl-2 text-xs opacity-50">
                  <BsKey className="h-3 w-3" />
                  SFTP Connection
                </div>
                <div className="flex flex-1 flex-col rounded-lg border border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] p-4 shadow-lg shadow-black/20">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    <div>
                      <Label className="text-xs text-zinc-500">Host</Label>
                      <div className="mt-1 font-mono text-sm text-zinc-100">
                        {server?.node?.host || <span className="text-zinc-600">Loading...</span>}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-zinc-500">Port</Label>
                      <div className="mt-1 font-mono text-sm text-zinc-100">
                        {server?.node?.sftpPort ?? 2022}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-zinc-500">Username</Label>
                      <div className="mt-1 font-mono text-sm break-all text-zinc-100">
                        {server && user ? (
                          `${server.id}.${user.email}`
                        ) : (
                          <span className="text-zinc-600">Loading...</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex gap-3">
                    <TextureButton
                      variant="minimal"
                      size="sm"
                      className="w-fit"
                      onClick={() => {
                        if (!server || !user) return;
                        const host = server.node?.host || "localhost";
                        const port = server.node?.sftpPort || 2022;
                        const username = `${server.id}.${user.email}`;
                        window.open(`sftp://${username}@${host}:${port}`, "_blank");
                      }}
                      disabled={!server || !user}
                    >
                      <BsKey className="h-4 w-4" />
                      Connect via SFTP
                    </TextureButton>

                    <TextureButton
                      variant="minimal"
                      size="sm"
                      className="w-fit"
                      onClick={() => {
                        if (!server || !user) return;
                        const host = server.node?.host || "localhost";
                        const port = server.node?.sftpPort || 2022;
                        const username = `${server.id}.${user.email}`;
                        navigator.clipboard.writeText(`sftp://${username}@${host}:${port}`);
                      }}
                      disabled={!server || !user}
                    >
                      Copy Connection URL
                    </TextureButton>
                  </div>

                  <p className="mt-4 text-xs text-zinc-600">
                    Use your account password to authenticate via SFTP.
                  </p>
                </div>
              </div>
            </FadeIn>
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
    </FadeIn>
  );
};

export default NetworkPage;

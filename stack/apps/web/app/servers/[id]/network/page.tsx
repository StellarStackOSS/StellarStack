"use client";

import { useState, useEffect, type JSX } from "react";
import { useParams } from "next/navigation";
import { useTheme as useNextTheme } from "next-themes";
import { cn } from "@workspace/ui/lib/utils";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { AnimatedBackground } from "@workspace/ui/components/shared/AnimatedBackground";
import { FloatingDots } from "@workspace/ui/components/shared/Animations";
import { SidebarTrigger } from "@workspace/ui/components/sidebar";
import { Switch } from "@workspace/ui/components/switch";
import { ConfirmationModal } from "@workspace/ui/components/shared/ConfirmationModal";
import { FormModal } from "@workspace/ui/components/shared/FormModal";
import { BsSun, BsMoon, BsPlus, BsTrash, BsGlobe, BsHddNetwork, BsKey, BsStar, BsStarFill } from "react-icons/bs";
import { useServer } from "@/components/server-provider";
import { ServerInstallingPlaceholder } from "@/components/server-installing-placeholder";
import { servers, type Allocation } from "@/lib/api";

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
  const { setTheme, resolvedTheme } = useNextTheme();
  const [mounted, setMounted] = useState(false);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [subdomains, setSubdomains] = useState<Subdomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [settingPrimary, setSettingPrimary] = useState<string | null>(null);

  // Get server data for SFTP details and primary allocation
  const { server, consoleInfo, isInstalling, refetch } = useServer();

  // Modal states
  const [deletePortModalOpen, setDeletePortModalOpen] = useState(false);
  const [addSubdomainModalOpen, setAddSubdomainModalOpen] = useState(false);
  const [deleteSubdomainModalOpen, setDeleteSubdomainModalOpen] = useState(false);
  const [selectedAllocation, setSelectedAllocation] = useState<Allocation | null>(null);
  const [selectedSubdomain, setSelectedSubdomain] = useState<Subdomain | null>(null);

  // Subdomain form states
  const [subdomainName, setSubdomainName] = useState("");
  const [subdomainTargetPort, setSubdomainTargetPort] = useState<string>("");
  const [subdomainSsl, setSubdomainSsl] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch allocations
  useEffect(() => {
    if (serverId) {
      fetchAllocations();
    }
  }, [serverId]);

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

  const isDark = mounted ? resolvedTheme === "dark" : true;

  if (!mounted) return null;

  if (isInstalling) {
    return (
      <div className={cn(
        "min-h-svh",
        isDark ? "bg-[#0b0b0a]" : "bg-[#f5f5f4]"
      )}>
        <AnimatedBackground isDark={isDark} />
        <ServerInstallingPlaceholder isDark={isDark} serverName={server?.name} />
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
    const defaultAllocation = allocations.find(a => a.id === server?.primaryAllocationId) || allocations[0];
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
    const selectedPortNumber = subdomainTargetPort ? parseInt(subdomainTargetPort) : allocations[0]?.port || 0;
    const newSubdomain: Subdomain = {
      id: `sub-${Date.now()}`,
      subdomain: subdomainName.toLowerCase(),
      domain: "stellarstack.app",
      targetPort: selectedPortNumber,
      ssl: subdomainSsl,
    };
    setSubdomains(prev => [...prev, newSubdomain]);
    setAddSubdomainModalOpen(false);
    resetSubdomainForm();
  };

  const handleDeleteSubdomain = () => {
    if (!selectedSubdomain) return;
    setSubdomains(prev => prev.filter(s => s.id !== selectedSubdomain.id));
    setDeleteSubdomainModalOpen(false);
    setSelectedSubdomain(null);
  };

  const isSubdomainValid = subdomainName.trim() !== "" && allocations.length > 0;
  const isPrimary = (allocation: Allocation) => allocation.id === server?.primaryAllocationId;

  return (
    <div className={cn(
      "min-h-full transition-colors relative",
      isDark ? "bg-[#0b0b0a]" : "bg-[#f5f5f4]"
    )}>
      <AnimatedBackground isDark={isDark} />
      <FloatingDots isDark={isDark} count={15} />

      <div className="relative p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <SidebarTrigger className={cn(
                "transition-all hover:scale-110 active:scale-95",
                isDark ? "text-zinc-400 hover:text-zinc-100" : "text-zinc-600 hover:text-zinc-900"
              )} />
              <div>
                <h1 className={cn(
                  "text-2xl font-light tracking-wider",
                  isDark ? "text-zinc-100" : "text-zinc-800"
                )}>
                  NETWORK
                </h1>
                <p className={cn(
                  "text-sm mt-1",
                  isDark ? "text-zinc-500" : "text-zinc-500"
                )}>
                  Server {server?.shortId || serverId} • Port allocation & subdomains
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTheme(isDark ? "light" : "dark")}
              className={cn(
                "transition-all hover:scale-110 active:scale-95 p-2",
                isDark
                  ? "border-zinc-700 text-zinc-400 hover:text-zinc-100 hover:border-zinc-500"
                  : "border-zinc-300 text-zinc-600 hover:text-zinc-900 hover:border-zinc-400"
              )}
            >
              {isDark ? <BsSun className="w-4 h-4" /> : <BsMoon className="w-4 h-4" />}
            </Button>
          </div>

          {/* Port Allocations Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BsHddNetwork className={cn("w-5 h-5", isDark ? "text-zinc-400" : "text-zinc-600")} />
                <h2 className={cn(
                  "text-sm font-medium uppercase tracking-wider",
                  isDark ? "text-zinc-300" : "text-zinc-700"
                )}>
                  Port Allocations
                </h2>
              </div>
            </div>

            {loading ? (
              <div className={cn(
                "p-8 text-center border",
                isDark ? "border-zinc-800 text-zinc-500" : "border-zinc-200 text-zinc-400"
              )}>
                Loading allocations...
              </div>
            ) : allocations.length === 0 ? (
              <div className={cn(
                "p-8 text-center border",
                isDark ? "border-zinc-800 text-zinc-500" : "border-zinc-200 text-zinc-400"
              )}>
                No allocations assigned to this server.
              </div>
            ) : (
              <div className="space-y-3">
                {allocations.map((allocation) => (
                  <div
                    key={allocation.id}
                    className={cn(
                      "relative p-4 border transition-all",
                      isDark
                        ? "bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] border-zinc-200/10"
                        : "bg-gradient-to-b from-white via-zinc-50 to-zinc-100 border-zinc-300"
                    )}
                  >
                    {/* Corner decorations */}
                    <div className={cn("absolute top-0 left-0 w-2 h-2 border-t border-l", isDark ? "border-zinc-500" : "border-zinc-400")} />
                    <div className={cn("absolute top-0 right-0 w-2 h-2 border-t border-r", isDark ? "border-zinc-500" : "border-zinc-400")} />
                    <div className={cn("absolute bottom-0 left-0 w-2 h-2 border-b border-l", isDark ? "border-zinc-500" : "border-zinc-400")} />
                    <div className={cn("absolute bottom-0 right-0 w-2 h-2 border-b border-r", isDark ? "border-zinc-500" : "border-zinc-400")} />

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "text-lg font-mono font-medium",
                          isDark ? "text-zinc-100" : "text-zinc-800"
                        )}>
                          {allocation.ip}:{allocation.port}
                        </div>
                        <div className="flex items-center gap-2">
                          {isPrimary(allocation) && (
                            <span className={cn(
                              "text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 border",
                              isDark ? "border-green-500/50 text-green-400" : "border-green-400 text-green-600"
                            )}>
                              Primary
                            </span>
                          )}
                          {allocation.alias && (
                            <span className={cn(
                              "text-sm",
                              isDark ? "text-zinc-500" : "text-zinc-500"
                            )}>
                              {allocation.alias}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!isPrimary(allocation) && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={settingPrimary === allocation.id}
                            onClick={() => handleSetPrimary(allocation)}
                            className={cn(
                              "transition-all p-2",
                              isDark
                                ? "border-zinc-700 text-zinc-400 hover:text-yellow-400 hover:border-yellow-700"
                                : "border-zinc-300 text-zinc-600 hover:text-yellow-600 hover:border-yellow-400"
                            )}
                            title="Set as primary"
                          >
                            {settingPrimary === allocation.id ? (
                              <span className="w-4 h-4 animate-spin">⏳</span>
                            ) : (
                              <BsStar className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                        {isPrimary(allocation) && (
                          <div className={cn(
                            "p-2",
                            isDark ? "text-yellow-400" : "text-yellow-600"
                          )}>
                            <BsStarFill className="w-4 h-4" />
                          </div>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isPrimary(allocation) || allocations.length <= 1}
                          onClick={() => openDeletePortModal(allocation)}
                          className={cn(
                            "transition-all p-2",
                            isDark
                              ? "border-red-900/60 text-red-400/80 hover:text-red-300 hover:border-red-700 disabled:opacity-30"
                              : "border-red-300 text-red-600 hover:text-red-700 hover:border-red-400 disabled:opacity-30"
                          )}
                        >
                          <BsTrash className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Subdomains Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BsGlobe className={cn("w-5 h-5", isDark ? "text-zinc-400" : "text-zinc-600")} />
                <h2 className={cn(
                  "text-sm font-medium uppercase tracking-wider",
                  isDark ? "text-zinc-300" : "text-zinc-700"
                )}>
                  Subdomains
                </h2>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={openAddSubdomainModal}
                className={cn(
                  "transition-all gap-2",
                  isDark
                    ? "border-zinc-700 text-zinc-400 hover:text-zinc-100 hover:border-zinc-500"
                    : "border-zinc-300 text-zinc-600 hover:text-zinc-900 hover:border-zinc-400"
                )}
              >
                <BsPlus className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">Add Subdomain</span>
              </Button>
            </div>

            {subdomains.length === 0 ? (
              <div className={cn(
                "p-8 text-center border",
                isDark ? "border-zinc-800 text-zinc-500" : "border-zinc-200 text-zinc-400"
              )}>
                No subdomains configured. Add a subdomain to create a friendly URL for your server.
              </div>
            ) : (
              <div className="space-y-3">
                {subdomains.map((sub) => (
                  <div
                    key={sub.id}
                    className={cn(
                      "relative p-4 border transition-all",
                      isDark
                        ? "bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] border-zinc-200/10"
                        : "bg-gradient-to-b from-white via-zinc-50 to-zinc-100 border-zinc-300"
                    )}
                  >
                    {/* Corner decorations */}
                    <div className={cn("absolute top-0 left-0 w-2 h-2 border-t border-l", isDark ? "border-zinc-500" : "border-zinc-400")} />
                    <div className={cn("absolute top-0 right-0 w-2 h-2 border-t border-r", isDark ? "border-zinc-500" : "border-zinc-400")} />
                    <div className={cn("absolute bottom-0 left-0 w-2 h-2 border-b border-l", isDark ? "border-zinc-500" : "border-zinc-400")} />
                    <div className={cn("absolute bottom-0 right-0 w-2 h-2 border-b border-r", isDark ? "border-zinc-500" : "border-zinc-400")} />

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "text-sm font-mono",
                          isDark ? "text-zinc-100" : "text-zinc-800"
                        )}>
                          {sub.subdomain}.{sub.domain}
                        </div>
                        <div className="flex items-center gap-2">
                          {sub.ssl && (
                            <span className={cn(
                              "text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 border",
                              isDark ? "border-green-500/50 text-green-400" : "border-green-400 text-green-600"
                            )}>
                              SSL
                            </span>
                          )}
                        </div>
                        <span className={cn(
                          "text-sm",
                          isDark ? "text-zinc-500" : "text-zinc-500"
                        )}>
                          → Port {sub.targetPort}
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDeleteSubdomainModal(sub)}
                        className={cn(
                          "transition-all p-2",
                          isDark
                            ? "border-red-900/60 text-red-400/80 hover:text-red-300 hover:border-red-700"
                            : "border-red-300 text-red-600 hover:text-red-700 hover:border-red-400"
                        )}
                      >
                        <BsTrash className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SFTP Connection Details Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BsKey className={cn("w-5 h-5", isDark ? "text-zinc-400" : "text-zinc-600")} />
                <h2 className={cn(
                  "text-sm font-medium uppercase tracking-wider",
                  isDark ? "text-zinc-300" : "text-zinc-700"
                )}>
                  SFTP Connection
                </h2>
              </div>
            </div>

            <div className={cn(
              "relative p-6 border transition-all",
              isDark
                ? "bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] border-zinc-200/10"
                : "bg-gradient-to-b from-white via-zinc-50 to-zinc-100 border-zinc-300"
            )}>
              {/* Corner decorations */}
              <div className={cn("absolute top-0 left-0 w-2 h-2 border-t border-l", isDark ? "border-zinc-500" : "border-zinc-400")} />
              <div className={cn("absolute top-0 right-0 w-2 h-2 border-t border-r", isDark ? "border-zinc-500" : "border-zinc-400")} />
              <div className={cn("absolute bottom-0 left-0 w-2 h-2 border-b border-l", isDark ? "border-zinc-500" : "border-zinc-400")} />
              <div className={cn("absolute bottom-0 right-0 w-2 h-2 border-b border-r", isDark ? "border-zinc-500" : "border-zinc-400")} />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className={cn(
                    "text-xs uppercase tracking-wider mb-1 block",
                    isDark ? "text-zinc-500" : "text-zinc-500"
                  )}>
                    Host
                  </label>
                  <div className={cn(
                    "text-sm font-mono",
                    isDark ? "text-zinc-100" : "text-zinc-800"
                  )}>
                    {server?.node?.host || "—"}
                  </div>
                </div>

                <div>
                  <label className={cn(
                    "text-xs uppercase tracking-wider mb-1 block",
                    isDark ? "text-zinc-500" : "text-zinc-500"
                  )}>
                    Port
                  </label>
                  <div className={cn(
                    "text-sm font-mono",
                    isDark ? "text-zinc-100" : "text-zinc-800"
                  )}>
                    {server?.node?.sftpPort || 2022}
                  </div>
                </div>

                <div>
                  <label className={cn(
                    "text-xs uppercase tracking-wider mb-1 block",
                    isDark ? "text-zinc-500" : "text-zinc-500"
                  )}>
                    Username
                  </label>
                  <div className={cn(
                    "text-sm font-mono",
                    isDark ? "text-zinc-100" : "text-zinc-800"
                  )}>
                    {server?.shortId || serverId}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    const host = server?.node?.host || "localhost";
                    const port = server?.node?.sftpPort || 2022;
                    const username = server?.shortId || serverId;
                    // Try to open SFTP URL - this will work if user has an SFTP handler installed
                    window.open(`sftp://${username}@${host}:${port}`, "_blank");
                  }}
                  className={cn(
                    "transition-all gap-2",
                    isDark
                      ? "border-purple-900/50 text-purple-400 hover:text-purple-300 hover:border-purple-700 hover:bg-purple-900/20"
                      : "border-purple-300 text-purple-600 hover:text-purple-700 hover:border-purple-400 hover:bg-purple-50"
                  )}
                >
                  <BsKey className="w-4 h-4" />
                  <span className="text-xs uppercase tracking-wider">Connect via SFTP</span>
                </Button>

                <Button
                  variant="outline"
                  onClick={() => {
                    const host = server?.node?.host || "localhost";
                    const port = server?.node?.sftpPort || 2022;
                    const username = server?.shortId || serverId;
                    navigator.clipboard.writeText(`sftp://${username}@${host}:${port}`);
                  }}
                  className={cn(
                    "transition-all gap-2",
                    isDark
                      ? "border-zinc-700 text-zinc-400 hover:text-zinc-100 hover:border-zinc-500"
                      : "border-zinc-300 text-zinc-600 hover:text-zinc-900 hover:border-zinc-400"
                  )}
                >
                  <span className="text-xs uppercase tracking-wider">Copy Connection URL</span>
                </Button>
              </div>

              <p className={cn(
                "text-xs mt-4",
                isDark ? "text-zinc-600" : "text-zinc-400"
              )}>
                Use your account password to authenticate via SFTP.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Port Modal */}
      <ConfirmationModal
        open={deletePortModalOpen}
        onOpenChange={setDeletePortModalOpen}
        title="Remove Allocation"
        description={`Are you sure you want to remove ${selectedAllocation?.ip}:${selectedAllocation?.port}? Services using this allocation will no longer be accessible.`}
        onConfirm={handleDeletePort}
        confirmLabel="Remove"
        variant="danger"
        isDark={isDark}
      />

      {/* Add Subdomain Modal */}
      <FormModal
        open={addSubdomainModalOpen}
        onOpenChange={setAddSubdomainModalOpen}
        title="Add Subdomain"
        description="Create a subdomain pointing to your server."
        onSubmit={handleAddSubdomain}
        submitLabel="Add Subdomain"
        isDark={isDark}
        isValid={isSubdomainValid}
      >
        <div className="space-y-4">
          <div>
            <label className={cn(
              "text-xs uppercase tracking-wider mb-2 block",
              isDark ? "text-zinc-400" : "text-zinc-600"
            )}>
              Subdomain Name
            </label>
            <div className="flex items-center gap-2">
              <Input
                value={subdomainName}
                onChange={(e) => setSubdomainName(e.target.value)}
                placeholder="e.g., play"
                className={cn(
                  "transition-all",
                  isDark
                    ? "bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600"
                    : "bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400"
                )}
              />
              <span className={cn(
                "text-sm shrink-0",
                isDark ? "text-zinc-500" : "text-zinc-500"
              )}>
                .stellarstack.app
              </span>
            </div>
          </div>
          <div>
            <label className={cn(
              "text-xs uppercase tracking-wider mb-2 block",
              isDark ? "text-zinc-400" : "text-zinc-600"
            )}>
              Target Port
            </label>
            {allocations.length > 0 ? (
              <div className="grid grid-cols-1 gap-2">
                {allocations.map((allocation) => (
                  <button
                    key={allocation.id}
                    type="button"
                    onClick={() => setSubdomainTargetPort(allocation.port.toString())}
                    className={cn(
                      "p-3 text-left border transition-all",
                      (subdomainTargetPort === allocation.port.toString() || (!subdomainTargetPort && isPrimary(allocation)))
                        ? isDark
                          ? "border-zinc-500 bg-zinc-800 text-zinc-100"
                          : "border-zinc-400 bg-zinc-100 text-zinc-900"
                        : isDark
                          ? "border-zinc-700 text-zinc-400 hover:border-zinc-600"
                          : "border-zinc-300 text-zinc-600 hover:border-zinc-400"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm">{allocation.ip}:{allocation.port}</span>
                        {isPrimary(allocation) && (
                          <span className={cn(
                            "text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 border",
                            isDark ? "border-green-500/50 text-green-400" : "border-green-400 text-green-600"
                          )}>
                            Primary
                          </span>
                        )}
                      </div>
                      {allocation.alias && (
                        <span className={cn(
                          "text-xs",
                          isDark ? "text-zinc-500" : "text-zinc-500"
                        )}>
                          {allocation.alias}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className={cn(
                "p-4 border text-center",
                isDark ? "bg-zinc-800/50 border-zinc-700" : "bg-zinc-100 border-zinc-300"
              )}>
                <p className={cn(
                  "text-sm",
                  isDark ? "text-zinc-400" : "text-zinc-500"
                )}>
                  No allocations available.
                </p>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between">
            <label className={cn(
              "text-xs uppercase tracking-wider",
              isDark ? "text-zinc-400" : "text-zinc-600"
            )}>
              Enable SSL
            </label>
            <Switch
              checked={subdomainSsl}
              onCheckedChange={setSubdomainSsl}
              isDark={isDark}
            />
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
        variant="danger"
        isDark={isDark}
      />
    </div>
  );
};

export default NetworkPage;

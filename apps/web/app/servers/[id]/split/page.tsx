"use client";

import { type JSX, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { cn } from "@stellarUI/lib/Utils";
import { TextureButton } from "@stellarUI/components/TextureButton";
import Input from "@stellarUI/components/Input/Input";
import Label from "@stellarUI/components/Label/Label";
import ConfirmationModal from "@stellarUI/components/ConfirmationModal/ConfirmationModal";
import FormModal from "@stellarUI/components/FormModal/FormModal";
import { FadeIn } from "@stellarUI/components/FadeIn/FadeIn";
import { BsArrowRight, BsExclamationTriangle, BsPlus, BsServer, BsTrash } from "react-icons/bs";
import { useServer } from "components/ServerStatusPages/ServerProvider/ServerProvider";
import { ServerInstallingPlaceholder } from "components/ServerStatusPages/ServerInstallingPlaceholder/ServerInstallingPlaceholder";
import { ServerSuspendedPlaceholder } from "components/ServerStatusPages/ServerSuspendedPlaceholder/ServerSuspendedPlaceholder";
import { type ChildServer, servers } from "@/lib/Api";
import { toast } from "sonner";
import GetErrorMessage from "@/lib/ErrorUtils";
import Spinner from "@stellarUI/components/Spinner/Spinner";

// Format MiB values (memory/disk are stored in MiB in the database)
const formatMiB = (mib: number): string => {
  if (mib === 0) return "0 MiB";
  if (mib < 1024) return `${mib} MiB`;
  const gib = mib / 1024;
  if (gib < 1024) return `${gib.toFixed(2)} GiB`;
  const tib = gib / 1024;
  return `${tib.toFixed(2)} TiB`;
};

const SplitPage = (): JSX.Element | null => {
  const params = useParams();
  const router = useRouter();
  const serverId = params.id as string;
  const { server, isInstalling, refetch } = useServer();
  const [children, setChildren] = useState<ChildServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [splitting, setSplitting] = useState(false);

  // Modal states
  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedChild, setSelectedChild] = useState<ChildServer | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formMemoryPercent, setFormMemoryPercent] = useState(25);
  const [formDiskPercent, setFormDiskPercent] = useState(25);
  const [formCpuPercent, setFormCpuPercent] = useState(25);

  useEffect(() => {
    if (serverId) {
      fetchChildren();
    }
  }, [serverId]);

  const fetchChildren = async () => {
    try {
      setLoading(true);
      const data = await servers.split.children(serverId);
      setChildren(data);
    } catch (error) {
      console.error("Failed to fetch child servers:", error);
    } finally {
      setLoading(false);
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

  const isChildServer = server?.parentServerId != null;
  const parentMemory = Number(server?.memory || 0);
  const parentDisk = Number(server?.disk || 0);
  const parentCpu = server?.cpu || 0;

  // Calculate what the child would get
  const childMemory = Math.floor((parentMemory * formMemoryPercent) / 100);
  const childDisk = Math.floor((parentDisk * formDiskPercent) / 100);
  const childCpu = Math.floor((parentCpu * formCpuPercent) / 100);

  // Calculate what would remain for parent
  const remainingMemory = parentMemory - childMemory;
  const remainingDisk = parentDisk - childDisk;
  const remainingCpu = parentCpu - childCpu;

  const resetForm = () => {
    setFormName("");
    setFormMemoryPercent(25);
    setFormDiskPercent(25);
    setFormCpuPercent(25);
  };

  const openSplitModal = () => {
    resetForm();
    setSplitModalOpen(true);
  };

  const openDeleteModal = (child: ChildServer) => {
    setSelectedChild(child);
    setDeleteModalOpen(true);
  };

  const handleSplit = async () => {
    if (!formName.trim()) {
      toast.error("Please enter a name for the child server");
      return;
    }

    setSplitting(true);
    try {
      const result = await servers.split.create(serverId, {
        name: formName,
        memoryPercent: formMemoryPercent,
        diskPercent: formDiskPercent,
        cpuPercent: formCpuPercent,
      });

      toast.success(`Child server "${result.childServer.name}" created`);
      setSplitModalOpen(false);
      resetForm();
      fetchChildren();
      refetch(); // Refresh parent server data
    } catch (error: unknown) {
      toast.error(GetErrorMessage(error, "Failed to split server"));
    } finally {
      setSplitting(false);
    }
  };

  const handleDeleteChild = async () => {
    if (!selectedChild) return;

    try {
      await servers.delete(selectedChild.id);
      toast.success("Child server deleted");
      setDeleteModalOpen(false);
      setSelectedChild(null);
      fetchChildren();
      refetch(); // Refresh parent to update resources
    } catch (error: unknown) {
      toast.error(GetErrorMessage(error, "Failed to delete child server"));
    }
  };

  const isFormValid =
    formName.trim().length > 0 &&
    formMemoryPercent >= 10 &&
    formMemoryPercent <= 90 &&
    formDiskPercent >= 10 &&
    formDiskPercent <= 90 &&
    formCpuPercent >= 10 &&
    formCpuPercent <= 90;

  return (
    <FadeIn className="flex min-h-[calc(100svh-1rem)] w-full flex-col">
      <div className="relative flex min-h-[calc(100svh-1rem)] w-full flex-col transition-colors">
        <div className="relative flex min-h-[calc(100svh-1rem)] w-full flex-col rounded-lg bg-card px-4 pb-4">
          {/* Header */}
          <FadeIn delay={0}>
            <div className="mb-6 flex items-center justify-end">
              <div className="flex items-center gap-2">
                {!isChildServer && (
                  <TextureButton
                    variant="primary"
                    size="sm"
                    className="w-fit"
                    onClick={openSplitModal}
                  >
                    <BsPlus className="h-4 w-4" />
                    Split Server
                  </TextureButton>
                )}
              </div>
            </div>
          </FadeIn>

          <div className="space-y-4">
            {/* Child Server Warning */}
            {isChildServer && (
              <FadeIn delay={0.05}>
                <div className="flex h-full flex-col rounded-lg border border-amber-900/30 bg-muted p-1 pt-2">
                  <div className="flex shrink-0 items-center gap-2 pb-2 pl-2 text-xs opacity-50">
                    <BsExclamationTriangle className="h-3 w-3 text-amber-400" />
                    <span className="text-amber-400">Notice</span>
                  </div>
                  <div className="flex flex-1 items-center gap-3 rounded-lg border border-amber-900/20 bg-gradient-to-b from-card via-secondary to-background p-4 shadow-lg shadow-black/20">
                    <img
                      src="/icons/24-triangle-warning.svg"
                      alt="Warning"
                      className="h-5 w-5 shrink-0"
                    />
                    <div>
                      <p className="text-sm font-medium text-zinc-200">This is a Child Server</p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        Child servers cannot be split further. Only parent servers can create child
                        servers.
                      </p>
                    </div>
                  </div>
                </div>
              </FadeIn>
            )}

            {/* Current Resources */}
            {!isChildServer && (
              <FadeIn delay={0.05}>
                <div className="flex h-full flex-col rounded-lg border border-white/5 bg-muted p-1 pt-2">
                  <div className="shrink-0 pb-2 pl-2 text-xs opacity-50">Current Resources</div>
                  <div className="flex flex-1 flex-col rounded-lg border border-zinc-200/10 bg-gradient-to-b from-card via-secondary to-background p-4 shadow-lg shadow-black/20">
                    <div className="grid grid-cols-3 gap-6">
                      <div>
                        <div className="text-xs tracking-wider text-zinc-500 uppercase">Memory</div>
                        <div className="mt-2 text-2xl font-light text-zinc-100">
                          {formatMiB(parentMemory)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs tracking-wider text-zinc-500 uppercase">Disk</div>
                        <div className="mt-2 text-2xl font-light text-zinc-100">
                          {formatMiB(parentDisk)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs tracking-wider text-zinc-500 uppercase">CPU</div>
                        <div className="mt-2 text-2xl font-light text-zinc-100">{parentCpu}%</div>
                      </div>
                    </div>
                  </div>
                </div>
              </FadeIn>
            )}

            {/* Child Servers */}
            <FadeIn delay={0.1}>
              <div className="flex h-full flex-col rounded-lg border border-white/5 bg-muted p-1 pt-2">
                <div className="shrink-0 pb-2 pl-2 text-xs opacity-50">
                  Child Servers {children.length > 0 && `(${children.length})`}
                </div>
                <div className="flex flex-1 flex-col rounded-lg border border-zinc-200/10 bg-gradient-to-b from-card via-secondary to-background shadow-lg shadow-black/20">
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <Spinner />
                    </div>
                  ) : children.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <img
                        src="/icons/24-storage.svg"
                        alt="No Child Servers"
                        className="mb-4 h-16 opacity-50"
                      />
                      <h3 className="mb-2 text-sm font-medium text-zinc-300">No Child Servers</h3>
                      <p className="mb-4 text-xs text-zinc-500">
                        {isChildServer
                          ? "Child servers cannot have their own children."
                          : "Split this server to create child servers with dedicated resources."}
                      </p>
                      {!isChildServer && (
                        <TextureButton
                          variant="minimal"
                          size="sm"
                          className="w-fit"
                          onClick={openSplitModal}
                        >
                          <BsPlus className="h-4 w-4" />
                          Split Server
                        </TextureButton>
                      )}
                    </div>
                  ) : (
                    children.map((child, index) => (
                      <div
                        key={child.id}
                        className={cn(
                          "flex items-center justify-between p-4 transition-colors hover:bg-zinc-800/20",
                          index !== children.length - 1 && "border-b border-zinc-800/50"
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-md border border-zinc-700 bg-zinc-800/50">
                            <BsServer className="h-5 w-5 text-zinc-400" />
                          </div>
                          <div>
                            <div className="flex items-center gap-3">
                              <h3 className="text-sm font-medium text-zinc-100">{child.name}</h3>
                              <span
                                className={cn(
                                  "rounded border px-2 py-0.5 text-[10px] font-medium tracking-wider uppercase",
                                  child.status === "RUNNING"
                                    ? "border-green-700/50 text-green-400"
                                    : child.status === "STOPPED"
                                      ? "border-zinc-700 text-zinc-500"
                                      : "border-amber-700/50 text-amber-400"
                                )}
                              >
                                {child.status}
                              </span>
                            </div>
                            <div className="mt-1 flex items-center gap-4 text-xs text-zinc-500">
                              <span>{formatMiB(child.memory)} RAM</span>
                              <span>•</span>
                              <span>{formatMiB(child.disk)} Disk</span>
                              <span>•</span>
                              <span>{child.cpu}% CPU</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <TextureButton
                            variant="minimal"
                            size="sm"
                            className="w-fit"
                            onClick={() => router.push(`/servers/${child.id}/overview`)}
                          >
                            Manage
                            <BsArrowRight className="h-4 w-4" />
                          </TextureButton>
                          <TextureButton
                            variant="destructive"
                            size="sm"
                            className="w-fit"
                            onClick={() => openDeleteModal(child)}
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
          </div>
        </div>
      </div>

      {/* Split Server Modal */}
      <FormModal
        open={splitModalOpen}
        onOpenChange={setSplitModalOpen}
        title="Split Server"
        description="Create a child server by allocating a portion of this server's resources."
        onSubmit={handleSplit}
        submitLabel={splitting ? "Splitting..." : "Create Child Server"}
        isValid={isFormValid && !splitting}
      >
        <div className="space-y-6">
          <div>
            <Label>Child Server Name</Label>
            <Input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Enter server name"
            />
          </div>

          {/* Resource Sliders */}
          <div className="space-y-4">
            {/* Memory */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label>Memory ({formMemoryPercent}%)</Label>
                <span className={cn("text-xs", "text-zinc-500")}>
                  {formatMiB(childMemory)} / {formatMiB(parentMemory)}
                </span>
              </div>
              <Input
                type="range"
                min="10"
                max="90"
                value={formMemoryPercent}
                onChange={(e) => setFormMemoryPercent(parseInt(e.target.value))}
              />
            </div>

            {/* Disk */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label>Disk ({formDiskPercent}%)</Label>
                <span className={cn("text-xs", "text-zinc-500")}>
                  {formatMiB(childDisk)} / {formatMiB(parentDisk)}
                </span>
              </div>
              <Input
                type="range"
                min="10"
                max="90"
                value={formDiskPercent}
                onChange={(e) => setFormDiskPercent(parseInt(e.target.value))}
              />
            </div>

            {/* CPU */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label>CPU ({formCpuPercent}%)</Label>
                <span className={cn("text-xs", "text-zinc-500")}>
                  {childCpu}% / {parentCpu}%
                </span>
              </div>
              <Input
                type="range"
                min="10"
                max="90"
                value={formCpuPercent}
                onChange={(e) => setFormCpuPercent(parseInt(e.target.value))}
              />
            </div>
          </div>

          {/* Preview */}
          <div className={cn("border p-4", "border-zinc-700 bg-zinc-900/50")}>
            <div
              className={cn("mb-3 text-xs font-medium tracking-wider uppercase", "text-zinc-400")}
            >
              After Split
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className={cn("mb-1 text-xs", "text-zinc-500")}>Parent Server</div>
                <div className={cn("text-sm", "text-zinc-300")}>
                  {formatMiB(remainingMemory)} RAM
                </div>
                <div className={cn("text-sm", "text-zinc-300")}>
                  {formatMiB(remainingDisk)} Disk
                </div>
                <div className={cn("text-sm", "text-zinc-300")}>{remainingCpu}% CPU</div>
              </div>
              <div>
                <div className={cn("mb-1 text-xs", "text-zinc-500")}>Child Server</div>
                <div className={cn("text-sm", "text-zinc-300")}>{formatMiB(childMemory)} RAM</div>
                <div className={cn("text-sm", "text-zinc-300")}>{formatMiB(childDisk)} Disk</div>
                <div className={cn("text-sm", "text-zinc-300")}>{childCpu}% CPU</div>
              </div>
            </div>
          </div>

          {/* Warning */}
          <div
            className={cn(
              "flex items-start gap-2 border p-3 text-xs",
              "border-amber-700/30 bg-amber-950/20 text-amber-200/80"
            )}
          >
            <BsExclamationTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              Splitting will permanently reduce this server's resources. The child server will
              inherit the same blueprint and configuration.
            </div>
          </div>
        </div>
      </FormModal>

      {/* Delete Child Server Modal */}
      <ConfirmationModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        title="Delete Child Server"
        description={`Are you sure you want to delete "${selectedChild?.name}"? This will permanently delete the server and all its data. Resources will be returned to the parent server.`}
        onConfirm={handleDeleteChild}
        confirmLabel="Delete Server"
      />
    </FadeIn>
  );
};

export default SplitPage;

"use client";

import { type JSX, useState } from "react";
import { useParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@stellarUI/lib/Utils";
import Input from "@stellarUI/components/Input/Input";
import ConfirmationModal from "@stellarUI/components/ConfirmationModal/ConfirmationModal";
import FormModal from "@stellarUI/components/FormModal/FormModal";
import Spinner from "@stellarUI/components/Spinner/Spinner";
import { FadeIn } from "@stellarUI/components/FadeIn/FadeIn";
import {
  BsCloudDownload,
  BsDownload,
  BsLock,
  BsPlus,
  BsTrash,
  BsUnlock,
  BsArchive,
} from "react-icons/bs";
import { useBackupMutations, useBackups } from "@/hooks/queries/UseBackups";
import type { Backup } from "@/lib/Api";
import { useServer } from "components/ServerStatusPages/ServerProvider/ServerProvider";
import { ServerInstallingPlaceholder } from "components/ServerStatusPages/ServerInstallingPlaceholder/ServerInstallingPlaceholder";
import { ServerSuspendedPlaceholder } from "components/ServerStatusPages/ServerSuspendedPlaceholder/ServerSuspendedPlaceholder";
import { toast } from "sonner";
import { TextureButton } from "@stellarUI/components/TextureButton";
import Label from "@stellarUI/components/Label/Label";
import ServerBackupStatusBadge, {
  convertServerBackupStatusToIcon,
} from "@/components/ServerBackupStatusBadge/ServerBackupStatusBadge";

const BackupsPage = (): JSX.Element | null => {
  const params = useParams();
  const serverId = params.id as string;
  const { server, isInstalling } = useServer();

  // React Query hooks
  const { data: backups = [], isLoading } = useBackups(serverId);
  const { create, remove, restore, lock, getDownloadToken } = useBackupMutations(serverId);

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null);

  // Form states
  const [backupName, setBackupName] = useState("");

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  // Check if a backup is currently in progress
  const isBackupInProgress = backups.some(
    (b) => b.status === "IN_PROGRESS" || b.status === "RESTORING"
  );

  // Backup limit from server
  const backupLimit = server?.backupLimit ?? 0;
  const backupsDisabled = backupLimit === 0;
  const completedBackups = backups.filter((b) => b.status === "COMPLETED").length;
  const canCreateBackup = !backupsDisabled && !isBackupInProgress && completedBackups < backupLimit;

  if (isInstalling) {
    return (
      <div className="min-h-svh">
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

  const openCreateModal = () => {
    setBackupName("");
    setCreateModalOpen(true);
  };

  const openDeleteModal = (backup: Backup) => {
    setSelectedBackup(backup);
    setDeleteModalOpen(true);
  };

  const openRestoreModal = (backup: Backup) => {
    setSelectedBackup(backup);
    setRestoreModalOpen(true);
  };

  const handleCreate = async () => {
    // Close modal immediately
    setCreateModalOpen(false);
    const name = backupName || `Backup ${new Date().toLocaleDateString()}`;
    setBackupName("");

    toast.loading("Creating backup...", { id: "backup-create" });

    try {
      await create.mutateAsync({
        name: name,
      });
      toast.success("Backup created", { id: "backup-create" });
    } catch (error) {
      toast.error("Failed to create backup", { id: "backup-create" });
    }
  };

  const handleDelete = async () => {
    if (!selectedBackup) return;
    try {
      await remove.mutateAsync(selectedBackup.id);
      toast.success("Backup deleted");
      setDeleteModalOpen(false);
      setSelectedBackup(null);
    } catch (error) {
      toast.error("Failed to delete backup");
    }
  };

  const handleRestore = async () => {
    if (!selectedBackup) return;
    try {
      await restore.mutateAsync(selectedBackup.id);
      toast.success("Backup restored");
      setRestoreModalOpen(false);
      setSelectedBackup(null);
    } catch (error) {
      toast.error("Failed to restore backup");
    }
  };

  const handleToggleLock = async (backup: Backup) => {
    try {
      await lock.mutateAsync({ backupId: backup.id, locked: !backup.isLocked });
      toast.success(backup.isLocked ? "Backup unlocked" : "Backup locked");
    } catch (error) {
      toast.error("Failed to update backup");
    }
  };

  const handleDownload = async (backup: Backup) => {
    try {
      const { downloadUrl } = await getDownloadToken.mutateAsync(backup.id);
      // downloadUrl already includes /api prefix, just add the origin
      const apiUrl =
        typeof window !== "undefined" &&
        window.location.hostname !== "localhost" &&
        window.location.hostname !== "127.0.0.1"
          ? window.location.origin
          : process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      window.open(`${apiUrl}${downloadUrl}`, "_blank");
    } catch (error) {
      toast.error("Failed to generate download link");
    }
  };

  return (
    <FadeIn className="flex min-h-[calc(100svh-1rem)] w-full flex-col">
      <div className="relative flex min-h-[calc(100svh-1rem)] w-full flex-col transition-colors">
        <div className="relative flex min-h-[calc(100svh-1rem)] w-full flex-col rounded-lg bg-card px-4 pb-4">
          {/* Header */}
          <FadeIn delay={0}>
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {!backupsDisabled && (
                  <TextureButton
                    variant="primary"
                    size="sm"
                    className="w-fit"
                    onClick={openCreateModal}
                    disabled={!canCreateBackup}
                  >
                    <BsPlus className="h-4 w-4" />
                    Create Backup
                  </TextureButton>
                )}
              </div>
            </div>
          </FadeIn>

          {/* Backups Card */}
          <FadeIn delay={0.05}>
            <div className="flex h-full flex-col rounded-lg border border-white/5 bg-muted p-1 pt-2">
              <div className="flex shrink-0 items-center justify-between pr-2 pb-2 pl-2">
                <div className="flex items-center gap-2 text-xs opacity-50">
                  <BsArchive className="h-3 w-3" />
                  Backups
                </div>
                <span className="text-xs text-zinc-500">
                  {completedBackups} / {backupLimit} used
                </span>
              </div>
              <div className="flex flex-1 flex-col rounded-lg border border-zinc-200/10 bg-gradient-to-b from-card via-secondary to-background shadow-lg shadow-black/20">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Spinner />
                  </div>
                ) : backupsDisabled ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <BsArchive className="mb-4 h-12 w-12 text-zinc-600" />
                    <h3 className="mb-2 text-sm font-medium text-zinc-300">Backups Disabled</h3>
                    <p className="text-xs text-zinc-500">
                      Contact an administrator to enable backups.
                    </p>
                  </div>
                ) : backups.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <BsArchive className="mb-4 h-12 w-12 text-zinc-600" />
                    <h3 className="mb-2 text-sm font-medium text-zinc-300">No Backups</h3>
                    <p className="mb-4 text-xs text-zinc-500">
                      Create your first backup to protect your data.
                    </p>
                    <TextureButton
                      variant="minimal"
                      size="sm"
                      className="w-fit"
                      onClick={openCreateModal}
                    >
                      <BsPlus className="h-4 w-4" />
                      Create Backup
                    </TextureButton>
                  </div>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {backups.map((backup, index) => (
                      <motion.div
                        key={backup.id}
                        layout
                        initial={{ opacity: 0, y: -20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -100, scale: 0.95 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className={cn(
                          "flex items-center justify-between p-4 transition-colors hover:bg-zinc-800/20",
                          index !== backups.length - 1 && "border-b border-zinc-800/50"
                        )}
                      >
                        <div className="flex items-center gap-4">
                          {convertServerBackupStatusToIcon(backup.status)}
                          <div>
                            <div className="flex items-center gap-3">
                              <h3 className="text-sm font-medium text-zinc-100">{backup.name}</h3>
                              {backup.isLocked && (
                                <span className="flex items-center gap-1 rounded border border-amber-500/50 px-2 py-0.5 text-[10px] font-medium tracking-wider text-amber-400 uppercase">
                                  <BsLock className="h-3 w-3" />
                                  Locked
                                </span>
                              )}
                              {backup.status !== "COMPLETED" && (
                                <ServerBackupStatusBadge status={backup.status} />
                              )}
                            </div>
                            <div className="mt-1 flex items-center gap-4 text-xs text-zinc-500">
                              <span>{formatFileSize(backup.size)}</span>
                              <span>•</span>
                              <span>{new Date(backup.createdAt).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <TextureButton
                            variant="minimal"
                            size="sm"
                            className="w-fit"
                            onClick={() => handleToggleLock(backup)}
                            disabled={lock.isPending || backup.status !== "COMPLETED"}
                            title={backup.isLocked ? "Unlock backup" : "Lock backup"}
                          >
                            {backup.isLocked ? (
                              <BsUnlock className="h-4 w-4" />
                            ) : (
                              <BsLock className="h-4 w-4" />
                            )}
                          </TextureButton>
                          <TextureButton
                            variant="minimal"
                            size="sm"
                            className="w-fit"
                            onClick={() => handleDownload(backup)}
                            disabled={getDownloadToken.isPending || backup.status !== "COMPLETED"}
                            title="Download backup"
                          >
                            <BsDownload className="h-4 w-4" />
                          </TextureButton>
                          <TextureButton
                            variant="minimal"
                            size="sm"
                            className="w-fit"
                            disabled={backup.status !== "COMPLETED"}
                            onClick={() => openRestoreModal(backup)}
                            title="Restore backup"
                          >
                            <BsCloudDownload className="h-4 w-4" />
                          </TextureButton>
                          <TextureButton
                            variant="destructive"
                            size="sm"
                            className="w-fit"
                            disabled={backup.isLocked || backup.status !== "COMPLETED"}
                            onClick={() => openDeleteModal(backup)}
                          >
                            <BsTrash className="h-4 w-4" />
                          </TextureButton>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </div>
          </FadeIn>
        </div>
      </div>

      {/* Create Backup Modal */}
      <FormModal
        open={createModalOpen}
        onOpenChange={(open) => !create.isPending && setCreateModalOpen(open)}
        title="Create Backup"
        description="Create a new manual backup of your server."
        onSubmit={handleCreate}
        submitLabel={create.isPending ? "Creating..." : "Create Backup"}
        isValid={!create.isPending}
        isLoading={create.isPending}
      >
        <div className="space-y-4">
          <div>
            <Label>Backup Name (Optional)</Label>
            <Input
              value={backupName}
              onChange={(e) => setBackupName(e.target.value)}
              placeholder="e.g., Pre-Update Backup"
              disabled={create.isPending}
              className={cn(
                "transition-all",
                "border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-600"
              )}
            />
            <p className={cn("mt-1 text-xs", "text-zinc-500")}>
              Leave empty for auto-generated name
            </p>
          </div>
        </div>
      </FormModal>

      {/* Restore Backup Modal */}
      <ConfirmationModal
        open={restoreModalOpen}
        onOpenChange={setRestoreModalOpen}
        title="Restore Backup"
        description={`Are you sure you want to restore "${selectedBackup?.name}"? This will replace your current server data with the backup contents.`}
        onConfirm={handleRestore}
        confirmLabel="Restore"
        isLoading={restore.isPending}
      />

      {/* Delete Backup Modal */}
      <ConfirmationModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        title="Delete Backup"
        description={`Are you sure you want to delete "${selectedBackup?.name}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        confirmLabel="Delete"
        isLoading={remove.isPending}
      />
    </FadeIn>
  );
};

export default BackupsPage;

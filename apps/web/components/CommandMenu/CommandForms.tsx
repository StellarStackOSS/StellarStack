"use client";

import { useState } from "react";
import { useCommandMenu } from "./hooks/UseCommandMenu";
import FormModal from "@stellarUI/components/FormModal/FormModal";
import Input from "@stellarUI/components/Input/Input";
import Label from "@stellarUI/components/Label/Label";
import Switch from "@stellarUI/components/Switch/Switch";
import { useQuery, useMutation } from "@tanstack/react-query";
import { servers } from "@/lib/Api";
import { toast } from "sonner";

/**
 * Form component for backup creation
 */
const BackupForm = ({ serverId, onSuccess }: { serverId: string; onSuccess: () => void }) => {
  const [name, setName] = useState("");
  const [locked, setLocked] = useState(false);
  const createBackupMutation = useMutation({
    mutationFn: () =>
      servers.backups.create(serverId, {
        name: name || undefined,
        locked,
      }),
    onSuccess: () => {
      toast.success("Backup created successfully");
      onSuccess();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to create backup");
    },
  });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="backup-name">Backup Name (optional)</Label>
        <Input
          id="backup-name"
          placeholder="My Backup"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-2">
        <Switch id="backup-locked" checked={locked} onCheckedChange={setLocked} />
        <Label htmlFor="backup-locked" className="mb-0">
          Lock backup
        </Label>
      </div>
    </div>
  );
};

/**
 * Main command forms component
 * Renders the active form modal based on the command type
 */
export const CommandForms = () => {
  const { state, closeForm } = useCommandMenu();
  const [isLoading, setIsLoading] = useState(false);

  if (!state.activeForm) return null;

  const { type, context } = state.activeForm;
  const serverId = context?.serverId;

  /**
   * Handle form submission
   */
  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      switch (type) {
        case "action-create-backup":
          // The form handles the submission
          break;
        case "action-create-schedule":
          toast.info("Navigate to schedules page to create schedule");
          closeForm();
          break;
        case "action-upload-files":
          toast.info("Navigate to file manager to upload files");
          closeForm();
          break;
        default:
          closeForm();
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Backup form
  if (type === "action-create-backup" && serverId) {
    return (
      <FormModal
        open={true}
        onOpenChange={closeForm}
        title="Create Backup"
        description="Create a new backup of your server"
        submitLabel="Create"
        onSubmit={handleSubmit}
        isLoading={isLoading}
      >
        <BackupForm serverId={serverId} onSuccess={() => closeForm()} />
      </FormModal>
    );
  }

  // Schedule form - navigate to schedules page instead
  if (type === "action-create-schedule" && serverId) {
    return (
      <FormModal
        open={true}
        onOpenChange={closeForm}
        title="Create Schedule"
        description="Create a new automated schedule"
        submitLabel="Continue"
        onSubmit={() => {
          context?.router.push(`/servers/${serverId}/schedules?create=true`);
          closeForm();
        }}
        isLoading={false}
      >
        <p className="text-muted-foreground text-sm">
          You'll be taken to the schedules page where you can create a detailed schedule with cron
          expressions and multiple tasks.
        </p>
      </FormModal>
    );
  }

  // Upload files - navigate to file manager
  if (type === "action-upload-files" && serverId) {
    return (
      <FormModal
        open={true}
        onOpenChange={closeForm}
        title="Upload Files"
        description="Upload files to your server"
        submitLabel="Continue"
        onSubmit={() => {
          context?.router.push(`/servers/${serverId}/files`);
          closeForm();
        }}
        isLoading={false}
      >
        <p className="text-muted-foreground text-sm">
          You'll be taken to the file manager where you can upload and manage your server files.
        </p>
      </FormModal>
    );
  }

  return null;
};

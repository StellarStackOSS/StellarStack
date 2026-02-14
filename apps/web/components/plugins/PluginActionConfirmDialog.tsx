"use client";

import React, { type JSX, useState } from "react";
import { BsExclamationTriangle, BsShieldCheck, BsCheckCircle } from "react-icons/bs";
import Dialog, {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@stellarUI/components/Dialog/Dialog";
import { TextureButton } from "@stellarUI/components/TextureButton";
import Switch from "@stellarUI/components/Switch/Switch";
import Label from "@stellarUI/components/Label/Label";

export interface PluginActionConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  isDestructive?: boolean; // Set to true for operations that modify/delete files
  hasBackupOption?: boolean; // Show backup toggle
  backupEnabled?: boolean; // Default backup state
  onBackupToggle?: (enabled: boolean) => void;
  confirmText?: string; // e.g., "Install", "Download"
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
  warnings?: string[]; // Additional warnings to display
}

export const PluginActionConfirmDialog = ({
  open,
  onOpenChange,
  title,
  description,
  isDestructive = false,
  hasBackupOption = false,
  backupEnabled = true,
  onBackupToggle,
  confirmText = "Confirm",
  onConfirm,
  isLoading = false,
  warnings = [],
}: PluginActionConfirmDialogProps): JSX.Element => {
  const [localBackupEnabled, setLocalBackupEnabled] = useState(backupEnabled);

  const handleBackupToggle = (enabled: boolean) => {
    setLocalBackupEnabled(enabled);
    onBackupToggle?.(enabled);
  };

  const handleConfirm = async () => {
    await onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-zinc-800 bg-zinc-900">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {isDestructive ? (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-950/50">
                <BsExclamationTriangle className="h-5 w-5 text-red-500" />
              </div>
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-950/50">
                <BsShieldCheck className="h-5 w-5 text-blue-400" />
              </div>
            )}
            <div>
              <DialogTitle className="text-lg font-semibold text-zinc-100">{title}</DialogTitle>
            </div>
          </div>
          <DialogDescription className="mt-2 text-sm text-zinc-400">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {/* Destructive Operation Warning */}
          {isDestructive && (
            <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-4">
              <div className="flex gap-3">
                <BsExclamationTriangle className="h-5 w-5 mt-0.5 shrink-0 text-red-500" />
                <div className="text-sm text-red-300">
                  <p className="font-semibold mb-2">This action will modify server files</p>
                  <ul className="space-y-1 text-xs">
                    <li>• Files in the installation directory will be replaced</li>
                    <li>• Configuration files may be overwritten</li>
                    <li>• Worlds and player data might be affected</li>
                    <li>• Cannot be undone without a backup</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Additional Warnings */}
          {warnings.length > 0 && (
            <div className="space-y-2">
              {warnings.map((warning, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-yellow-900/50 bg-yellow-950/20 p-3"
                >
                  <p className="text-xs text-yellow-700">{warning}</p>
                </div>
              ))}
            </div>
          )}

          {/* Backup Option */}
          {hasBackupOption && (
            <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/30 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="flex items-center gap-2 text-sm font-medium text-zinc-200 cursor-pointer">
                    <BsCheckCircle className="h-4 w-4 text-green-500" />
                    Create Backup Before Installing
                  </Label>
                  <p className="mt-1 text-xs text-zinc-500">
                    A snapshot will be created so you can restore if something goes wrong
                  </p>
                </div>
                <Switch
                  checked={localBackupEnabled}
                  onCheckedChange={handleBackupToggle}
                  disabled={isLoading}
                />
              </div>

              {!localBackupEnabled && (
                <div className="mt-3 rounded border border-yellow-900/30 bg-yellow-950/10 p-2">
                  <p className="text-xs text-yellow-600">
                    ⚠️ Proceeding without a backup. Make sure you have manually backed up important
                    files.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Required Permissions Info */}
          <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/30 p-3">
            <p className="text-xs font-medium text-zinc-300 mb-2">Required Permissions:</p>
            <ul className="space-y-1 text-xs text-zinc-400">
              {isDestructive && (
                <>
                  <li>✓ files.write - Download and write files</li>
                  <li>✓ backups.create - Create server backup (if enabled)</li>
                </>
              )}
              <li>✓ console.send - Send server notifications</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex justify-end gap-2 border-t border-zinc-700/50 pt-4">
            <TextureButton
              variant="minimal"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </TextureButton>
            <TextureButton
              onClick={handleConfirm}
              disabled={isLoading}
              className={isDestructive ? "bg-red-600 hover:bg-red-700" : ""}
            >
              {isLoading ? `${confirmText}ing...` : confirmText}
            </TextureButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

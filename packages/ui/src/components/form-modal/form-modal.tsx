"use client";

import { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { TextureButton } from "@workspace/ui/components/texture-button";

export interface FormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  submitLabel?: string;
  cancelLabel?: string;
  onSubmit: () => void;
  onCancel?: () => void;
  isLoading?: boolean;
  isValid?: boolean;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
}

export const FormModal = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  submitLabel = "Save",
  cancelLabel = "Cancel",
  onSubmit,
  onCancel,
  isLoading = false,
  isValid = true,
  size = "md",
}: FormModalProps) => {
  const handleCancel = () => {
    onCancel?.();
    onOpenChange(false);
  };

  const handleSubmit = () => {
    if (isValid) {
      onSubmit();
    }
  };

  const sizeClasses = {
    sm: "sm:max-w-sm",
    md: "sm:max-w-md",
    lg: "sm:max-w-lg",
    xl: "sm:max-w-xl",
    "2xl": "sm:max-w-2xl",
    "3xl": "sm:max-w-3xl",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={sizeClasses[size]}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto py-2 pr-4">{children}</div>
        <DialogFooter>
          <TextureButton
            className="w-full"
            variant="secondary"
            onClick={handleCancel}
            disabled={isLoading}
          >
            {cancelLabel}
          </TextureButton>
          <TextureButton
            className="w-full"
            variant="success"
            onClick={handleSubmit}
            disabled={isLoading || !isValid}
          >
            {isLoading ? "Saving..." : submitLabel}
          </TextureButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

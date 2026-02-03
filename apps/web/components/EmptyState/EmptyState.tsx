"use client";

import { ReactNode } from "react";
import { cn } from "@stellarUI/lib/utils";
import { TextureButton } from "@stellarUI/components/TextureButton";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState = ({ icon, title, description, action }: EmptyStateProps) => (
  <div
    className={cn(
      "relative border rounded-lg border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] p-8 text-center"
    )}
  >
    <div className={cn("mx-auto mb-4 h-12 w-12 text-zinc-600")}>{icon}</div>
    <h3 className={cn("mb-2 text-lg font-medium text-zinc-300")}>{title}</h3>
    <p className={cn("mb-4 text-sm text-zinc-500")}>{description}</p>
    {action && (
      <TextureButton variant="minimal" onClick={action.onClick}>
        {action.label}
      </TextureButton>
    )}
  </div>
);

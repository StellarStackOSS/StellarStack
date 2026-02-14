"use client";

import { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@stellarUI/lib/Utils";
import {TextureButton} from "@stellarUI/components/TextureButton";
import { ArrowLeft } from "lucide-react";

interface AdminPageHeaderProps {
  title: string;
  description?: string;
  action?: {
    label: string;
    icon: ReactNode;
    onClick: () => void;
  };
  showBackButton?: boolean;
}

export const AdminPageHeader = ({
  title,
  description,
  action,
  showBackButton = true,
}: AdminPageHeaderProps) => {
  const router = useRouter();

  return (
    <div className="mb-8 flex items-center justify-between">
      <div className="flex items-center gap-4">
        {showBackButton && (
          <TextureButton variant="minimal"
            onClick={() => router.push("/admin")}
          >
            <ArrowLeft className="h-4 w-4" />
          </TextureButton>
        )}
        <div>
          <h1
            className={cn(
              "text-2xl font-light tracking-wider",
              "text-zinc-100"
            )}
          >
            {title}
          </h1>
          {description && (
            <p className={cn("mt-1 text-sm", "text-zinc-500")}>
              {description}
            </p>
          )}
        </div>
      </div>
      {action && (
        <TextureButton
          onClick={action.onClick}
        >
          {action.icon}
          {action.label}
        </TextureButton>
      )}
    </div>
  );
};

"use client";

import { cn } from "@workspace/ui/lib/utils";

interface FormFieldLabelProps {
  label: string;
  isDark?: boolean;
}

export const FormFieldLabel = ({ label, isDark = true }: FormFieldLabelProps) => (
  <label
    className={cn(
      "mb-2 block text-xs tracking-wider uppercase",
      isDark ? "text-zinc-400" : "text-zinc-600"
    )}
  >
    {label}
  </label>
);

"use client";

import { cn } from "@workspace/ui/lib/utils";
import { Input } from "@workspace/ui/components/input";
import { FormFieldLabel } from "components/ServerPageComponents";

interface WebhookUrlFieldProps {
  value: string;
  onChange: (value: string) => void;
  isDark?: boolean;
}

export const WebhookUrlField = ({ value, onChange, isDark = true }: WebhookUrlFieldProps) => (
  <div>
    <FormFieldLabel label="Discord Webhook URL" isDark={isDark} />
    <Input
      type="url"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="https://discordapp.com/api/webhooks/..."
      className={cn(
        "font-mono text-sm transition-all",
        isDark
          ? "border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-600"
          : "border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400"
      )}
    />
    <p className={cn("mt-1 text-xs", isDark ? "text-zinc-500" : "text-zinc-400")}>
      Get this from your Discord server's webhook settings
    </p>
  </div>
);

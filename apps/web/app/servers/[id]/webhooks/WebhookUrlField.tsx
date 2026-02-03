"use client";

import {cn} from "@stellarUI/lib/utils";
import {Input} from "@stellarUI/components/Input/Input";
import {Label} from "@stellarUI/components/Label/Label";

interface WebhookUrlFieldProps {
  value: string;
  onChange: (value: string) => void;
}

export const WebhookUrlField = ({ value, onChange }: WebhookUrlFieldProps) => (
  <div>
    <Label>Discord Webhook URL</Label>
    <Input
      type="url"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="https://discordapp.com/api/webhooks/..."
      className={cn(
        "font-mono text-sm transition-all",
        "border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-600"
      )}
    />
    <p className={cn("mt-1 text-xs", "text-zinc-500")}>
      Get this from your Discord server's webhook settings
    </p>
  </div>
);

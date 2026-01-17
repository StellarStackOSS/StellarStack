"use client";

import { type WebhookEvent } from "@/lib/api";
import { cn } from "@workspace/ui/lib/utils";
import { BsCheck2 } from "react-icons/bs";
import { TextureButton } from "@workspace/ui/components/texture-button";

interface WebhookEventSelectorProps {
  events: Array<{ value: WebhookEvent; label: string; description: string }>;
  selectedEvents: WebhookEvent[];
  onToggle: (event: WebhookEvent) => void;
}

export const WebhookEventSelector = ({
  events,
  selectedEvents,
  onToggle,
}: WebhookEventSelectorProps) => (
  <div className="space-y-2">
    {events.map((event) => (
      <TextureButton variant="minimal"
        key={event.value}
        onClick={() => onToggle(event.value)}
      >
        <div
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded border",
            selectedEvents.includes(event.value)
              ? "border-green-500 bg-green-500/20"
              : "border-zinc-600"
          )}
        >
          {selectedEvents.includes(event.value) && (
            <BsCheck2
              className={cn("h-3 w-3", "text-green-400")}
            />
          )}
        </div>
        <div className="flex-1">
          <div
            className={cn(
              "text-sm font-medium",
              "text-zinc-200"
            )}
          >
            {event.label}
          </div>
          <div className={cn("text-xs", "text-zinc-500")}>
            {event.description}
          </div>
        </div>
      </TextureButton>
    ))}
  </div>
);

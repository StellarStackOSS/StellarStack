"use client";

import { type WebhookEvent } from "@/lib/api";
import { cn } from "@workspace/ui/lib/utils";
import { BsCheck2 } from "react-icons/bs";

interface WebhookEventSelectorProps {
  events: Array<{ value: WebhookEvent; label: string; description: string }>;
  selectedEvents: WebhookEvent[];
  onToggle: (event: WebhookEvent) => void;
  isDark?: boolean;
}

export const WebhookEventSelector = ({
  events,
  selectedEvents,
  onToggle,
  isDark = true,
}: WebhookEventSelectorProps) => (
  <div className="space-y-2">
    {events.map((event) => (
      <button
        key={event.value}
        type="button"
        onClick={() => onToggle(event.value)}
        className={cn(
          "flex w-full items-center gap-3 border p-3 text-left transition-all",
          selectedEvents.includes(event.value)
            ? isDark
              ? "border-zinc-500 bg-zinc-800"
              : "border-zinc-400 bg-zinc-100"
            : isDark
              ? "border-zinc-700 hover:border-zinc-600"
              : "border-zinc-300 hover:border-zinc-400"
        )}
      >
        <div
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded border",
            selectedEvents.includes(event.value)
              ? isDark
                ? "border-green-500 bg-green-500/20"
                : "border-green-400 bg-green-50"
              : isDark
                ? "border-zinc-600"
                : "border-zinc-300"
          )}
        >
          {selectedEvents.includes(event.value) && (
            <BsCheck2
              className={cn("h-3 w-3", isDark ? "text-green-400" : "text-green-600")}
            />
          )}
        </div>
        <div className="flex-1">
          <div
            className={cn(
              "text-sm font-medium",
              isDark ? "text-zinc-200" : "text-zinc-800"
            )}
          >
            {event.label}
          </div>
          <div className={cn("text-xs", isDark ? "text-zinc-500" : "text-zinc-500")}>
            {event.description}
          </div>
        </div>
      </button>
    ))}
  </div>
);

"use client";

import { type WebhookEvent } from "@/lib/api";
import { cn } from "@stellarUI/lib/utils";
import { BsCheck2 } from "react-icons/bs";
import { TextureButton } from "@stellarUI/components/TextureButton";
import Checkbox from "@stellarUI/components/Checkbox/Checkbox";

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
      <div className="flex flex-row select-none cursor-pointer gap-4 p-2 rounded-lg border border-white/10 hover:border-white/50 hover:bg-white/15 duration-150 transition-all bg-white/5"
        key={event.value}
        onClick={() => onToggle(event.value)}
      >
        <Checkbox
          checked={selectedEvents.includes(event.value)}
          onCheckedChange={() => onToggle(event.value)}
        />
        {/*<div*/}
        {/*  className={cn(*/}
        {/*    "flex h-5 w-5 items-center justify-center rounded border",*/}
        {/*    selectedEvents.includes(event.value)*/}
        {/*      ? "border-green-500 bg-green-500/20"*/}
        {/*      : "border-zinc-600"*/}
        {/*  )}*/}
        {/*>*/}
        {/*  {selectedEvents.includes(event.value) && (*/}
        {/*    <BsCheck2*/}
        {/*      className={cn("h-3 w-3", "text-green-400")}*/}
        {/*    />*/}
        {/*  )}*/}
        {/*</div>*/}
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
      </div>
    ))}
  </div>
);

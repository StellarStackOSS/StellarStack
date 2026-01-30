"use client";

import type { StatsSchema } from "@stellarstack/plugin-sdk";

interface StatsRendererProps {
  schema: StatsSchema;
  pluginId: string;
  serverId: string;
  pluginConfig?: Record<string, unknown>;
}

export function StatsRenderer({ schema }: StatsRendererProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {schema.items.map((item) => (
        <div key={item.id} className="rounded-md border border-white/10 bg-white/5 p-3">
          <p className="text-xs text-gray-500">{item.label}</p>
          <p className="mt-1 text-lg font-semibold">—</p>
        </div>
      ))}
    </div>
  );
}

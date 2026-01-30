"use client";

import type { DataTableSchema } from "@stellarstack/plugin-sdk";

interface DataTableRendererProps {
  schema: DataTableSchema;
  pluginId: string;
  serverId: string;
  pluginConfig?: Record<string, unknown>;
}

export function DataTableRenderer({ schema }: DataTableRendererProps) {
  return (
    <div className="rounded-md border border-white/10 bg-white/5 p-4">
      <h2 className="mb-2 text-lg font-semibold">{schema.title || "Table"}</h2>
      <p className="text-xs text-gray-500">Table rendering coming soon</p>
    </div>
  );
}

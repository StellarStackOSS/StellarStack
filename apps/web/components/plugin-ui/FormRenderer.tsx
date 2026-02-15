"use client";

import type { JSX } from "react";
import type { FormSchema } from "@stellarstack/plugin-sdk";

interface FormRendererProps {
  schema: FormSchema;
  pluginId: string;
  serverId: string;
  pluginConfig?: Record<string, unknown>;
}

export const FormRenderer = ({ schema }: FormRendererProps): JSX.Element => {
  return (
    <div className="rounded-md border border-white/10 bg-white/5 p-4">
      <h2 className="mb-2 text-lg font-semibold">{schema.title || "Form"}</h2>
      {schema.description && <p className="mb-4 text-sm text-gray-400">{schema.description}</p>}
      <p className="text-xs text-gray-500">Form rendering coming soon</p>
    </div>
  );
};

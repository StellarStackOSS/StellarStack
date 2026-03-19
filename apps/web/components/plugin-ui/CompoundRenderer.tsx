"use client";

import type { JSX } from "react";
import type { CompoundSchema } from "@stellarstack/plugin-sdk";
import { SchemaRenderer } from "./SchemaRenderer";

interface CompoundRendererProps {
  schema: CompoundSchema;
  pluginId: string;
  serverId: string;
  pluginConfig?: Record<string, unknown>;
}

export const CompoundRenderer = ({
  schema,
  pluginId,
  serverId,
  pluginConfig,
}: CompoundRendererProps): JSX.Element => {
  const layoutClass =
    schema.layout === "horizontal"
      ? "grid grid-cols-2 gap-4"
      : schema.layout === "grid"
        ? "grid grid-cols-1 gap-4 lg:grid-cols-2"
        : "space-y-6";

  return (
    <div className={layoutClass}>
      {schema.sections.map((section, index) => (
        <div key={index}>
          {(section.title || section.description) && (
            <div className="mb-4">
              {section.title && <h2 className="text-lg font-semibold">{section.title}</h2>}
              {section.description && (
                <p className="text-sm text-gray-400">{section.description}</p>
              )}
            </div>
          )}
          <SchemaRenderer
            schema={section.schema}
            pluginId={pluginId}
            serverId={serverId}
            pluginConfig={pluginConfig}
          />
        </div>
      ))}
    </div>
  );
};

"use client";

import type { JSX } from "react";
import { type UISchema } from "@stellarstack/plugin-sdk";
import { SearchAndInstallRenderer } from "./SearchAndInstallRenderer";
import { FormRenderer } from "./FormRenderer";
import { DataTableRenderer } from "./DataTableRenderer";
import { ActionButtonRenderer } from "./ActionButtonRenderer";
import { StatsRenderer } from "./StatsRenderer";
import { CompoundRenderer } from "./CompoundRenderer";

// ============================================
// Props
// ============================================

interface SchemaRendererProps {
  schema: UISchema;
  pluginId: string;
  serverId: string;
  pluginConfig?: Record<string, unknown>;
}

// ============================================
// Component
// ============================================

/**
 * Generic schema renderer that renders any plugin UI from a declarative schema.
 * Routes to specialized renderers based on schema type.
 */
export const SchemaRenderer = ({
  schema,
  pluginId,
  serverId,
  pluginConfig,
}: SchemaRendererProps): JSX.Element => {
  const commonProps = {
    pluginId,
    serverId,
    pluginConfig,
  };

  switch (schema.type) {
    case "search-and-install":
      return <SearchAndInstallRenderer schema={schema} {...commonProps} />;

    case "form":
      return <FormRenderer schema={schema} {...commonProps} />;

    case "data-table":
      return <DataTableRenderer schema={schema} {...commonProps} />;

    case "action-button":
      return <ActionButtonRenderer schema={schema} {...commonProps} />;

    case "stats":
      return <StatsRenderer schema={schema} {...commonProps} />;

    case "compound":
      return <CompoundRenderer schema={schema} {...commonProps} />;

    default:
      const _exhaustive: never = schema;
      return _exhaustive;
  }
};

export default SchemaRenderer;

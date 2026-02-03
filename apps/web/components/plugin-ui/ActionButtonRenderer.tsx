"use client";

import type { ActionButtonSchema } from "@stellarstack/plugin-sdk";
import { TextureButton } from "@stellarUI/components/TextureButton";

interface ActionButtonRendererProps {
  schema: ActionButtonSchema;
  pluginId: string;
  serverId: string;
  pluginConfig?: Record<string, unknown>;
}

export function ActionButtonRenderer({ schema }: ActionButtonRendererProps) {
  return (
    <TextureButton disabled>
      {schema.label}
    </TextureButton>
  );
}

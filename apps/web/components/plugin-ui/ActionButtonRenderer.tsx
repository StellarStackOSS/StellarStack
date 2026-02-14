"use client";

import type { JSX } from "react";
import type { ActionButtonSchema } from "@stellarstack/plugin-sdk";
import { TextureButton } from "@stellarUI/components/TextureButton";

interface ActionButtonRendererProps {
  schema: ActionButtonSchema;
  pluginId: string;
  serverId: string;
  pluginConfig?: Record<string, unknown>;
}

export const ActionButtonRenderer = ({ schema }: ActionButtonRendererProps): JSX.Element => {
  return (
    <TextureButton disabled>
      {schema.label}
    </TextureButton>
  );
};

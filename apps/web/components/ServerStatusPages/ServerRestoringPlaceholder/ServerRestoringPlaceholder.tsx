"use client";

import { ServerStatusPlaceholder } from "../ServerStatusPlaceholder";

interface ServerRestoringPlaceholderProps {
  serverName?: string;
}

export const ServerRestoringPlaceholder = ({ serverName }: ServerRestoringPlaceholderProps) => (
  <ServerStatusPlaceholder serverName={serverName} status="restoring" />
);

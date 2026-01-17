"use client";

import { ServerStatusPlaceholder } from "../server-status-placeholder";

interface ServerRestoringPlaceholderProps {
  serverName?: string;
}

export const ServerRestoringPlaceholder = ({ serverName }: ServerRestoringPlaceholderProps) => (
  <ServerStatusPlaceholder serverName={serverName} status="restoring" />
);

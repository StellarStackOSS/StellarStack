"use client";

import { ServerStatusPlaceholder } from "../server-status-placeholder";

interface ServerMaintenancePlaceholderProps {
  serverName?: string;
}

export const ServerMaintenancePlaceholder = ({ serverName }: ServerMaintenancePlaceholderProps) => (
  <ServerStatusPlaceholder serverName={serverName} status="maintenance" />
);

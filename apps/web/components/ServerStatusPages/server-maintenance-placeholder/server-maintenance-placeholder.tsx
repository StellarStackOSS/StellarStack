"use client";

import { ServerStatusPlaceholder } from "../server-status-placeholder";

interface ServerMaintenancePlaceholderProps {
  isDark?: boolean;
  serverName?: string;
}

export const ServerMaintenancePlaceholder = ({ isDark = true, serverName }: ServerMaintenancePlaceholderProps) => (
  <ServerStatusPlaceholder isDark={isDark} serverName={serverName} status="maintenance" />
);

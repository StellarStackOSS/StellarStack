"use client";

import { ServerStatusPlaceholder } from "../server-status-placeholder";

interface ServerSuspendedPlaceholderProps {
  isDark?: boolean;
  serverName?: string;
}

export const ServerSuspendedPlaceholder = ({ isDark = true, serverName }: ServerSuspendedPlaceholderProps) => (
  <ServerStatusPlaceholder isDark={isDark} serverName={serverName} status="suspended" />
);

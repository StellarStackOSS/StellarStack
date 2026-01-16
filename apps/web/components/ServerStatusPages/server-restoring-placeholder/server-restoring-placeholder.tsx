"use client";

import { ServerStatusPlaceholder } from "../server-status-placeholder";

interface ServerRestoringPlaceholderProps {
  isDark?: boolean;
  serverName?: string;
}

export const ServerRestoringPlaceholder = ({ isDark = true, serverName }: ServerRestoringPlaceholderProps) => (
  <ServerStatusPlaceholder isDark={isDark} serverName={serverName} status="restoring" />
);

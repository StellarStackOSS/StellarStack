"use client";

import { ServerStatusPlaceholder } from "../server-status-placeholder";

interface ServerInstallingPlaceholderProps {
  isDark?: boolean;
  serverName?: string;
}

export const ServerInstallingPlaceholder = ({ isDark = true, serverName }: ServerInstallingPlaceholderProps) => (
  <ServerStatusPlaceholder isDark={isDark} serverName={serverName} status="installing" />
);

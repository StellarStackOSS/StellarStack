"use client";

import { ServerStatusPlaceholder } from "../server-status-placeholder";

interface ServerInstallingPlaceholderProps {
  serverName?: string;
}

export const ServerInstallingPlaceholder = ({ serverName }: ServerInstallingPlaceholderProps) => (
  <ServerStatusPlaceholder serverName={serverName} status="installing" />
);

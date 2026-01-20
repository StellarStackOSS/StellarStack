"use client";

import {ServerStatusPlaceholder} from "../server-status-placeholder";

interface ServerSuspendedPlaceholderProps {
  serverName?: string;
}

export const ServerSuspendedPlaceholder = ({ serverName }: ServerSuspendedPlaceholderProps) => (
  <ServerStatusPlaceholder serverName={serverName} status="suspended" />
);

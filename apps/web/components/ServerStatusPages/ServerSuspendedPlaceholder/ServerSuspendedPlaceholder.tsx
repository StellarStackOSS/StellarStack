"use client";

import { ServerStatusPlaceholder } from "../ServerStatusPlaceholder";

interface ServerSuspendedPlaceholderProps {
  serverName?: string;
}

export const ServerSuspendedPlaceholder = ({ serverName }: ServerSuspendedPlaceholderProps) => (
  <ServerStatusPlaceholder serverName={serverName} status="suspended" />
);

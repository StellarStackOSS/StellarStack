"use client";

import { ServerStatusPlaceholder } from "../ServerStatusPlaceholder";

interface ServerMaintenancePlaceholderProps {
  serverName?: string;
}

export const ServerMaintenancePlaceholder = ({ serverName }: ServerMaintenancePlaceholderProps) => (
  <ServerStatusPlaceholder serverName={serverName} status="maintenance" />
);

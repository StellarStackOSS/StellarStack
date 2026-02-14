"use client";

import { ServerStatusPlaceholder } from "../ServerStatusPlaceholder";

interface ServerInstallingPlaceholderProps {
  serverName?: string;
}

export const ServerInstallingPlaceholder = ({ serverName }: ServerInstallingPlaceholderProps) => (
  <ServerStatusPlaceholder serverName={serverName} status="installing" />
);

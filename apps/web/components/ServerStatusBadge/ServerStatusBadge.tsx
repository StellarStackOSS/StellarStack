import { Server } from "@/lib/ApiTypes";
import React from "react";
import TextureBadge from "@stellarUI/components/TextureBadge/TextureBadge";

interface ServerStatusBadgeProps {
  server: Server | null;
}

const convertServerStatusToBadgeVariant = (status: string) => {
  switch (status) {
    case "running":
      return "success";
    case "stopped":
      return "destructive";
    case "starting":
    case "stopping":
      return "warning";
    default:
      return "primary";
  }
};

const ServerStatusBadge: React.FunctionComponent<ServerStatusBadgeProps> = ({ server }) => {
  return (
    <TextureBadge
      size="default"
      variant={convertServerStatusToBadgeVariant(server?.status.toLowerCase() || "unknown")}
    >
      {server?.status}
    </TextureBadge>
  );
};
export default ServerStatusBadge;

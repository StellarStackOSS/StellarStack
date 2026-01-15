import { Server } from "@/lib/api.types";
import React from "react";

interface ServerStatusBadgeProps {
  server: Server | null;
}

const ServerStatusBadge: React.FunctionComponent<ServerStatusBadgeProps> = ({ server }) => {
  return <div>{server?.status}</div>;
};
export default ServerStatusBadge;

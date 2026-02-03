import { type Backup } from "@/lib/api.types";
import React from "react";
import { TextureBadge } from "@stellarUI/components/TextureBadge/TextureBadge";
import { BsCheckCircle, BsCloudDownload, BsTrash } from "react-icons/bs";
import Spinner from "@stellarUI/components/Spinner/Spinner";

interface ServerBackupStatusBadgeProps {
  status: Backup["status"];
}

const convertServerStatusToBadgeVariant = (status: string) => {
  switch (status) {
    case "COMPLETED":
      return "success";
    case "FAILED":
      return "destructive";
    case "IN_PROGRESS":
    case "RESTORING":
      return "warning";
    default:
      return "primary";
  }
};

export const convertServerBackupStatusToIcon = (status: string) => {
  switch (status) {
    case "COMPLETED":
      return <BsCheckCircle className="h-4 w-4 text-green-500" />;
    case "IN_PROGRESS":
      return <Spinner className="h-4 w-4" />;
    case "RESTORING":
      return <BsCloudDownload className="h-4 w-4 text-amber-500" />;
    case "FAILED":
      return <BsTrash className="h-4 w-4 text-red-500" />;
    default:
      return <BsCheckCircle className="h-4 w-4 text-green-500" />;
  }
};

const ServerBackupStatusBadge: React.FunctionComponent<ServerBackupStatusBadgeProps> = ({
  status,
}) => {
  return (
    <TextureBadge size="default" variant={convertServerStatusToBadgeVariant(status)}>
      {status.replace("_", " ")}
    </TextureBadge>
  );
};
export default ServerBackupStatusBadge;

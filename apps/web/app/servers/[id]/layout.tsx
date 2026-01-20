"use client";

import { useParams } from "next/navigation";
import { memo } from "react";
import { SidebarInset, SidebarProvider } from "@workspace/ui/components/sidebar";
import { ServerProvider, useServer } from "components/ServerStatusPages/server-provider";
import { ServerMaintenancePlaceholder } from "@/components/ServerStatusPages/server-maintenance-placeholder/server-maintenance-placeholder";
import { ServerSuspendedPlaceholder } from "@/components/ServerStatusPages/server-suspended-placeholder/server-suspended-placeholder";
import { ServerRestoringPlaceholder } from "@/components/ServerStatusPages/server-restoring-placeholder/server-restoring-placeholder";
import { UploadProvider } from "@/components/Providers/UploadProvider/UploadProvider";
import { UploadProgressIndicator } from "@/components/UploadProgressIndicator/UploadProgressIndicator";
import { UnifiedSidebar } from "@/components/UnifiedSidebar/UnifiedSidebar";

// Memoized background component to prevent re-renders
const PersistentBackground = memo(function PersistentBackground() {
  return <></>;
});

// Wrapper component that checks server status and shows placeholder if needed
function ServerStatusWrapper({ children }: { children: React.ReactNode }) {
  const { server } = useServer();

  // Show suspended placeholder if server is suspended
  if (server?.status === "SUSPENDED") {
    return (
      <div className="min-h-svh bg-[#0b0b0a]">
        <ServerSuspendedPlaceholder serverName={server?.name} />
      </div>
    );
  }

  // Show maintenance placeholder if server is under maintenance
  if (server?.status === "MAINTENANCE") {
    return (
      <div className="min-h-svh bg-[#0b0b0a]">
        <ServerMaintenancePlaceholder serverName={server?.name} />
      </div>
    );
  }

  // Show restoring placeholder if server is being restored from backup
  if (server?.status === "RESTORING") {
    return (
      <div className="min-h-svh bg-[#0b0b0a]">
        <ServerRestoringPlaceholder serverName={server?.name} />
      </div>
    );
  }

  return <>{children}</>;
}

export default function ServerLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const params = useParams();
  const serverId = params.id as string;

  return (
    <UploadProvider>
      <ServerProvider serverId={serverId}>
        {/* Persistent background that doesn't re-render on navigation */}
        <PersistentBackground />

        <SidebarProvider>
          <UnifiedSidebar />
          <SidebarInset>
            <ServerStatusWrapper>
              {children}
              <UploadProgressIndicator />
            </ServerStatusWrapper>
          </SidebarInset>
        </SidebarProvider>
      </ServerProvider>
    </UploadProvider>
  );
}

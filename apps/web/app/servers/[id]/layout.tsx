"use client";

import { useParams, usePathname } from "next/navigation";
import { type JSX, memo } from "react";
import { SidebarInset, SidebarProvider } from "@stellarUI/components/Sidebar/Sidebar";
import { ServerProvider, useServer } from "components/ServerStatusPages/ServerProvider/ServerProvider";
import { ServerMaintenancePlaceholder } from "@/components/ServerStatusPages/ServerMaintenancePlaceholder/ServerMaintenancePlaceholder";
import { ServerSuspendedPlaceholder } from "@/components/ServerStatusPages/ServerSuspendedPlaceholder/ServerSuspendedPlaceholder";
import { ServerRestoringPlaceholder } from "@/components/ServerStatusPages/ServerRestoringPlaceholder/ServerRestoringPlaceholder";
import { UploadProgressIndicator } from "@/components/UploadProgressIndicator/UploadProgressIndicator";
import { UnifiedSidebar, appNavItems } from "@/components/UnifiedSidebar/UnifiedSidebar";
import { UploadProvider } from "@/components/providers/UploadProvider/UploadProvider";

// Memoized background component to prevent re-renders
const PersistentBackground = memo(function PersistentBackground() {
  return <></>;
});

/** Persistent page title derived from the current pathname */
const ContentHeader = ({ serverId }: { serverId: string }) => {
  const pathname = usePathname();
  const prefix = `/servers/${serverId}`;

  const matchedItem = appNavItems.find((item) => {
    const fullHref = `${prefix}${item.href}`;
    return pathname === fullHref || pathname.startsWith(fullHref + "/");
  });

  const pageTitle = matchedItem?.title ?? "";

  if (!pageTitle) return null;

  return (
    <div className="px-4 pt-4 pb-2">
      <h1 className="text-lg font-medium tracking-wider">{pageTitle}</h1>
    </div>
  );
};

// Wrapper component that checks server status and shows placeholder if needed
const ServerStatusWrapper = ({ children }: { children: React.ReactNode }): JSX.Element => {
  const { server } = useServer();

  // Show suspended placeholder if server is suspended
  if (server?.status === "SUSPENDED") {
    return (
      <div className="min-h-svh bg-background">
        <ServerSuspendedPlaceholder serverName={server?.name} />
      </div>
    );
  }

  // Show maintenance placeholder if server is under maintenance
  if (server?.status === "MAINTENANCE") {
    return (
      <div className="min-h-svh bg-background">
        <ServerMaintenancePlaceholder serverName={server?.name} />
      </div>
    );
  }

  // Show restoring placeholder if server is being restored from backup
  if (server?.status === "RESTORING") {
    return (
      <div className="min-h-svh bg-background">
        <ServerRestoringPlaceholder serverName={server?.name} />
      </div>
    );
  }

  return <>{children}</>;
};

const ServerLayout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): JSX.Element => {
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
            <ContentHeader serverId={serverId} />
            <ServerStatusWrapper>
              {children}
              <UploadProgressIndicator />
            </ServerStatusWrapper>
          </SidebarInset>
        </SidebarProvider>
      </ServerProvider>
    </UploadProvider>
  );
};

export default ServerLayout;

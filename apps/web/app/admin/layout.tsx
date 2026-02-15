"use client";

import { memo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SidebarInset, SidebarProvider } from "@stellarUI/components/Sidebar/Sidebar";
import { useAuth } from "@/hooks/AuthProvider/AuthProvider";
import { cn } from "@stellarUI/lib/Utils";
import { UnifiedSidebar } from "@/components/UnifiedSidebar/UnifiedSidebar";

// Memoized background component to prevent re-renders
const PersistentBackground = memo(function PersistentBackground() {
  return <></>;
});

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAdmin, isLoading, isAuthenticated } = useAuth();

  // Redirect non-admins
  useEffect(() => {
    if (!isLoading && isAuthenticated && !isAdmin) {
      router.push("/servers");
    }
    if (!isLoading && !isAuthenticated) {
      router.push("/");
    }
  }, [isAdmin, isLoading, isAuthenticated, router]);

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className={cn("bg-background flex min-h-svh items-center justify-center")}>
        <PersistentBackground />
        <div className={cn("relative z-10 text-sm tracking-wider text-zinc-500 uppercase")}>
          Loading...
        </div>
      </div>
    );
  }

  // Don't render if not admin
  if (!isAdmin) {
    return null;
  }

  return (
    <>
      <PersistentBackground />
      <SidebarProvider>
        <UnifiedSidebar />
        <SidebarInset className={cn("bg-transparent transition-colors")}>{children}</SidebarInset>
      </SidebarProvider>
    </>
  );
}

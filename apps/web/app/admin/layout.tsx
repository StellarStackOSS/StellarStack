"use client";

import { memo, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme as useNextTheme } from "next-themes";
import { SidebarInset, SidebarProvider } from "@workspace/ui/components/sidebar";
import { useAuth } from "hooks/auth-provider";
import { AnimatedBackground } from "@workspace/ui/components/animated-background";
import { FloatingDots } from "@workspace/ui/components/floating-particles";
import { cn } from "@workspace/ui/lib/utils";
import { UnifiedSidebar } from "@/components/UnifiedSidebar/UnifiedSidebar";

// Memoized background component to prevent re-renders
const PersistentBackground = memo(function PersistentBackground() {
  return (
    <>
      <AnimatedBackground />
      <FloatingDots count={15} />
    </>
  );
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
      <div
        className={cn(
          "flex min-h-svh items-center justify-center bg-[#0b0b0a]",
        )}
      >
        <PersistentBackground />
        <div
          className={cn(
            "relative z-10 text-sm tracking-wider uppercase text-zinc-500",
          )}
        >
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
        <SidebarInset
          className={cn("transition-colors bg-transparent")}
        >
          {children}
        </SidebarInset>
      </SidebarProvider>
    </>
  );
}

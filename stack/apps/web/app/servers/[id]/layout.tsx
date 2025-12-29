"use client";

import { useParams } from "next/navigation";
import { useTheme } from "next-themes";
import { useState, useEffect, memo } from "react";
import { SidebarProvider, SidebarInset } from "@workspace/ui/components/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ServerProvider } from "@/components/server-provider";
import { AnimatedBackground } from "@workspace/ui/components/animated-background";
import { FloatingDots } from "@workspace/ui/components/floating-particles";

// Memoized background component to prevent re-renders
const PersistentBackground = memo(function PersistentBackground({ isDark }: { isDark: boolean }) {
  return (
    <>
      <AnimatedBackground isDark={isDark} />
      <FloatingDots isDark={isDark} count={15} />
    </>
  );
});

export default function ServerLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const params = useParams();
  const serverId = params.id as string;
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? resolvedTheme === "dark" : true;

  return (
    <ServerProvider serverId={serverId}>
      {/* Persistent background that doesn't re-render on navigation */}
      <PersistentBackground isDark={isDark} />

      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          {children}
        </SidebarInset>
      </SidebarProvider>
    </ServerProvider>
  );
}

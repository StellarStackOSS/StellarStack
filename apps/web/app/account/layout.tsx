"use client";

import {memo} from "react";
import {SidebarInset, SidebarProvider} from "@workspace/ui/components/sidebar";
import {AnimatedBackground} from "@workspace/ui/components/animated-background";
import {UnifiedSidebar} from "@/components/UnifiedSidebar/UnifiedSidebar";

// Memoized background component to prevent re-renders
const PersistentBackground = memo(function PersistentBackground() {
  return (
    <>
      <AnimatedBackground />
    </>
  );
});

export default function AccountLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <PersistentBackground />
      <SidebarProvider>
        <UnifiedSidebar />
        <SidebarInset>{children}</SidebarInset>
      </SidebarProvider>
    </>
  );
}

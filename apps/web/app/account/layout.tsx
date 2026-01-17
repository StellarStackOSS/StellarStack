"use client";

import { memo } from "react";
import { SidebarProvider, SidebarInset } from "@workspace/ui/components/sidebar";
import { AccountSidebar } from "@/components/account-sidebar";
import { AnimatedBackground } from "@workspace/ui/components/animated-background";
import { FloatingDots } from "@workspace/ui/components/floating-particles";

// Memoized background component to prevent re-renders
const PersistentBackground = memo(function PersistentBackground() {
  return (
    <>
      <AnimatedBackground />
      <FloatingDots count={15} />
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
        <AccountSidebar />
        <SidebarInset>{children}</SidebarInset>
      </SidebarProvider>
    </>
  );
}

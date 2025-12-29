"use client";

import { PageTransition } from "@workspace/ui/components/page-transition";

export default function ServerTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageTransition>{children}</PageTransition>;
}

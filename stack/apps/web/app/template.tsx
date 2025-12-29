"use client";

import { PageTransition } from "@workspace/ui/components/page-transition";

export default function RootTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageTransition>{children}</PageTransition>;
}

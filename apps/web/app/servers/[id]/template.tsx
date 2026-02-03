"use client";

import { PageTransition } from "@stellarUI/components/PageTransition/PageTransition";

export default function ServerTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageTransition>{children}</PageTransition>;
}

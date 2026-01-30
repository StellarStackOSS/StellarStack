"use client";

import { Badge } from "@workspace/ui/components/badge";
import { BsCheckCircle, BsExclamationTriangle, BsShield } from "react-icons/bs";

// ============================================
// Props
// ============================================

interface PluginTrustBadgeProps {
  trustLevel: "official" | "community";
  securityScore?: number;
  isBuiltIn?: boolean;
  showScore?: boolean;
}

// ============================================
// Component
// ============================================

/**
 * Displays a trust badge for a plugin.
 * Official plugins show a checkmark, community plugins show security score.
 */
export function PluginTrustBadge({
  trustLevel,
  securityScore,
  isBuiltIn,
  showScore = true,
}: PluginTrustBadgeProps) {
  if (isBuiltIn) {
    return (
      <Badge className="gap-1" variant="default">
        <BsCheckCircle className="h-3 w-3" />
        Official
      </Badge>
    );
  }

  if (trustLevel === "official") {
    return (
      <Badge className="gap-1" variant="default">
        <BsCheckCircle className="h-3 w-3" />
        Verified
      </Badge>
    );
  }

  if (trustLevel === "community") {
    const scoreColor =
      securityScore === undefined
        ? "bg-gray-600"
        : securityScore >= 80
          ? "bg-green-600"
          : securityScore >= 60
            ? "bg-yellow-600"
            : "bg-red-600";

    const scoreIcon =
      securityScore === undefined
        ? BsExclamationTriangle
        : securityScore >= 60
          ? BsCheckCircle
          : BsShield;

    const Icon = scoreIcon;

    const scoreText =
      securityScore === undefined
        ? "Community"
        : `Score: ${securityScore}%`;

    return (
      <Badge className={`gap-1 ${scoreColor}`} variant="secondary">
        <Icon className="h-3 w-3" />
        {scoreText}
      </Badge>
    );
  }

  return null;
}

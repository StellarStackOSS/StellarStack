'use client';

import React from 'react';
import Card, { CardContent, CardDescription, CardHeader, CardTitle } from '@stellarUI/components/Card/Card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { AnalyticsComparison } from "./Types";

/**
 * Props for AnalyticsCard component.
 */
interface AnalyticsCardProps {
  /** Title displayed at the top of the card */
  title: string;
  /** Optional description text below the title */
  description?: string;
  /** The metric value to display */
  value: number | string;
  /** Unit label shown next to the value */
  unit?: string;
  /** Optional icon element */
  icon?: React.ReactNode;
  /** Comparison data for trend display */
  comparison?: AnalyticsComparison;
  /** Click handler for the card */
  onClick?: () => void;
  /** Whether the card is in a loading state */
  isLoading?: boolean;
}

/**
 * Format large numbers for display (e.g., 1000000 -> 1.0M).
 *
 * @param value - Number to format
 * @returns Formatted string
 */
const FormatLargeNumber = (value: number): string => {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toString();
};

/**
 * Render trend indicator icon and percentage.
 *
 * @param props - Props containing comparison data
 * @returns React element with trend indicator
 */
const TrendIndicator = ({ comparison }: { comparison: AnalyticsComparison }) => {
  const { trend, percentageChange } = comparison;

  return (
    <div className="flex items-center gap-1 text-sm">
      {trend === 'up' && <TrendingUp className="h-4 w-4" />}
      {trend === 'down' && <TrendingDown className="h-4 w-4" />}
      {trend === 'stable' && <Minus className="h-4 w-4" />}
      <span className="font-medium">{Math.abs(percentageChange)}%</span>
    </div>
  );
};

/**
 * Analytics Card Component.
 *
 * Displays a metric with optional trend and comparison data.
 * Uses existing Card and Badge components from the UI library.
 *
 * @component
 * @example
 * ```tsx
 * <AnalyticsCard
 *   title="Active Servers"
 *   value={42}
 *   unit="servers"
 *   comparison={{ current: 42, previous: 38, percentageChange: 10.5, trend: 'up' }}
 * />
 * ```
 *
 * @param props - AnalyticsCard configuration
 * @returns Analytics card component
 */
const AnalyticsCard = ({
  title,
  description,
  value,
  unit,
  icon,
  comparison,
  onClick,
  isLoading = false,
}: AnalyticsCardProps) => {
  return (
    <Card className={onClick ? 'cursor-pointer' : ''} onClick={onClick}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-sm font-semibold">{title}</CardTitle>
            {description && <CardDescription className="text-xs">{description}</CardDescription>}
          </div>
          {icon && <div>{icon}</div>}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-10 bg-muted rounded animate-pulse" />
        ) : (
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">
                {FormatLargeNumber(typeof value === 'number' ? value : 0)}
              </span>
              {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
            </div>

            {comparison && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">vs previous period</span>
                <TrendIndicator comparison={comparison} />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AnalyticsCard;

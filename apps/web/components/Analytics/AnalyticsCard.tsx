'use client';

import React from 'react';
import Card, { CardContent, CardDescription, CardHeader, CardTitle } from '@stellarUI/components/Card/Card';
import Badge from '@stellarUI/components/Badge/Badge';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { AnalyticsComparison } from '@/lib/types/analytics';

/**
 * Props for AnalyticsCard component
 */
interface AnalyticsCardProps {
  title: string;
  description?: string;
  value: number | string;
  unit?: string;
  icon?: React.ReactNode;
  comparison?: AnalyticsComparison;
  onClick?: () => void;
  isLoading?: boolean;
}

/**
 * Format large numbers for display (e.g., 1000000 -> 1.0M)
 * @param value - Number to format
 * @returns Formatted string
 */
const formatLargeNumber = (value: number): string => {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toString();
};

/**
 * Render trend indicator icon and percentage
 * @param comparison - Comparison data with trend
 * @returns React element with trend indicator
 */
const TrendIndicator: React.FC<{ comparison: AnalyticsComparison }> = ({ comparison }) => {
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
 * Analytics Card Component
 *
 * Displays a metric with optional trend and comparison data.
 * Uses existing Card and Badge components from shadcn/ui.
 *
 * @component
 * @example
 * <AnalyticsCard
 *   title="Active Servers"
 *   value={42}
 *   unit="servers"
 *   comparison={{ current: 42, previous: 38, percentageChange: 10.5, trend: 'up' }}
 * />
 */
const AnalyticsCard: React.FC<AnalyticsCardProps> = ({
  title,
  description,
  value,
  unit,
  icon,
  comparison,
  onClick,
  isLoading = false,
}) => {
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
                {formatLargeNumber(typeof value === 'number' ? value : 0)}
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

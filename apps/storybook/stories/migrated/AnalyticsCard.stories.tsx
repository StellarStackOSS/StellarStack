import type { Meta, StoryObj } from "@storybook/react";
import AnalyticsCard from "@stellarUI/components/AnalyticsCard/AnalyticsCard";
import { TrendingUp } from "lucide-react";

const meta: Meta<typeof AnalyticsCard> = {
  title: "Migrated/AnalyticsCard",
  component: AnalyticsCard,
  tags: ["autodocs"],
  argTypes: {
    title: { control: "text" },
    description: { control: "text" },
    value: { control: "number" },
    unit: { control: "text" },
    isLoading: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof AnalyticsCard>;

export const Default: Story = {
  args: {
    title: "Active Servers",
    value: 42,
    unit: "servers",
  },
};

export const TrendUp: Story = {
  args: {
    title: "Active Users",
    value: 1250,
    unit: "users",
    comparison: {
      current: 1250,
      previous: 1100,
      percentageChange: 13.6,
      trend: "up",
    },
    icon: <TrendingUp className="h-4 w-4 text-green-500" />,
  },
};

export const TrendDown: Story = {
  args: {
    title: "Error Rate",
    value: 23,
    unit: "errors",
    description: "Last 24 hours",
    comparison: {
      current: 23,
      previous: 45,
      percentageChange: -48.9,
      trend: "down",
    },
  },
};

export const Loading: Story = {
  args: {
    title: "Loading Metric",
    value: 0,
    isLoading: true,
  },
};

export const LargeNumber: Story = {
  args: {
    title: "Total Requests",
    value: 2_500_000,
    unit: "requests",
    comparison: {
      current: 2500000,
      previous: 2300000,
      percentageChange: 8.7,
      trend: "up",
    },
  },
};

import type { Meta, StoryObj } from "@storybook/react";
import ChartContainer, {
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@stellarUI/components/Chart/Chart";
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";

const CHART_DATA = [
  { month: "Jan", desktop: 186, mobile: 80 },
  { month: "Feb", desktop: 305, mobile: 200 },
  { month: "Mar", desktop: 237, mobile: 120 },
  { month: "Apr", desktop: 73, mobile: 190 },
  { month: "May", desktop: 209, mobile: 130 },
  { month: "Jun", desktop: 214, mobile: 140 },
];

const CHART_CONFIG: ChartConfig = {
  desktop: { label: "Desktop", color: "hsl(var(--chart-1))" },
  mobile: { label: "Mobile", color: "hsl(var(--chart-2))" },
};

const meta: Meta<typeof ChartContainer> = {
  title: "Data Display/Chart",
  component: ChartContainer,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof ChartContainer>;

export const LineChartStory: Story = {
  name: "Line",
  render: () => (
    <ChartContainer config={CHART_CONFIG} className="h-[300px] w-[500px]">
      <LineChart data={CHART_DATA}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Line type="monotone" dataKey="desktop" stroke="var(--color-desktop)" />
        <Line type="monotone" dataKey="mobile" stroke="var(--color-mobile)" />
      </LineChart>
    </ChartContainer>
  ),
};

export const BarChartStory: Story = {
  name: "Bar",
  render: () => (
    <ChartContainer config={CHART_CONFIG} className="h-[300px] w-[500px]">
      <BarChart data={CHART_DATA}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="desktop" fill="var(--color-desktop)" />
        <Bar dataKey="mobile" fill="var(--color-mobile)" />
      </BarChart>
    </ChartContainer>
  ),
};

export const AreaChartStory: Story = {
  name: "Area",
  render: () => (
    <ChartContainer config={CHART_CONFIG} className="h-[300px] w-[500px]">
      <AreaChart data={CHART_DATA}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area type="monotone" dataKey="desktop" stroke="var(--color-desktop)" fill="var(--color-desktop)" fillOpacity={0.3} />
        <Area type="monotone" dataKey="mobile" stroke="var(--color-mobile)" fill="var(--color-mobile)" fillOpacity={0.3} />
      </AreaChart>
    </ChartContainer>
  ),
};

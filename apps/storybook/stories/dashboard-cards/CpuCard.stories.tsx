import type { Meta, StoryObj } from "@storybook/react";
import CpuCard from "@stellarUI/components/CpuCard/CpuCard";
import { DragDropGridMockProvider } from "@stellarUI/components/DragDropGrid/DragDropGridMockProvider";
import { GenerateHistory, GenerateCoreUsage } from "../_helpers/MockData";

const meta: Meta<typeof CpuCard> = {
  title: "Dashboard Cards/CpuCard",
  component: CpuCard,
  tags: ["autodocs"],
  decorators: [(Story) => <DragDropGridMockProvider defaultSize="sm"><Story /></DragDropGridMockProvider>],
};

export default meta;
type Story = StoryObj<typeof CpuCard>;

export const Default: Story = {
  args: {
    itemId: "cpu-1",
    percentage: 45,
    history: GenerateHistory(30, 45, 20),
    coreUsage: GenerateCoreUsage(8),
  },
};

export const HighUsage: Story = {
  args: {
    itemId: "cpu-2",
    percentage: 92,
    history: GenerateHistory(30, 90, 8),
    coreUsage: GenerateCoreUsage(8).map((c) => ({ ...c, percentage: 80 + Math.random() * 20 })),
  },
};

export const Idle: Story = {
  args: {
    itemId: "cpu-3",
    percentage: 3,
    history: GenerateHistory(30, 3, 2),
    coreUsage: GenerateCoreUsage(4).map((c) => ({ ...c, percentage: Math.random() * 5 })),
  },
};

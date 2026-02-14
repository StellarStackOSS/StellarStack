import type { Meta, StoryObj } from "@storybook/react";
import { CpuCoreGrid } from "@stellarUI/components/CpuCoreGrid/CpuCoreGrid";
import { GenerateCoreUsage } from "../_helpers/MockData";

const meta: Meta<typeof CpuCoreGrid> = {
  title: "Dashboard Cards/CpuCoreGrid",
  component: CpuCoreGrid,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof CpuCoreGrid>;

export const Default: Story = {
  args: {
    cores: GenerateCoreUsage(8),
    isOffline: false,
  },
};

export const AllHigh: Story = {
  args: {
    cores: GenerateCoreUsage(16).map((c) => ({ ...c, percentage: 85 + Math.random() * 15 })),
    isOffline: false,
  },
};

export const Offline: Story = {
  args: {
    cores: GenerateCoreUsage(8),
    isOffline: true,
  },
};

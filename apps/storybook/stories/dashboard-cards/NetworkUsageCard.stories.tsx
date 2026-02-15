import type { Meta, StoryObj } from "@storybook/react";
import NetworkUsageCard from "@stellarUI/components/NetworkUsageCard/NetworkUsageCard";
import DragDropGridMockProvider from "@stellarUI/components/DragDropGrid/DragDropGridMockProvider";
import { GenerateHistory } from "../_helpers/MockData";

const meta: Meta<typeof NetworkUsageCard> = {
  title: "Dashboard Cards/NetworkUsageCard",
  component: NetworkUsageCard,
  tags: ["autodocs"],
  decorators: [(Story) => <DragDropGridMockProvider defaultSize="sm"><Story /></DragDropGridMockProvider>],
};

export default meta;
type Story = StoryObj<typeof NetworkUsageCard>;

export const Default: Story = {
  args: {
    itemId: "net-1",
    rxBytes: 1_073_741_824,
    txBytes: 536_870_912,
    rxHistory: GenerateHistory(30, 30, 15),
    txHistory: GenerateHistory(30, 15, 10),
  },
};

export const HighTraffic: Story = {
  args: {
    itemId: "net-2",
    rxBytes: 10_737_418_240,
    txBytes: 5_368_709_120,
    rxHistory: GenerateHistory(30, 85, 10),
    txHistory: GenerateHistory(30, 70, 15),
  },
};

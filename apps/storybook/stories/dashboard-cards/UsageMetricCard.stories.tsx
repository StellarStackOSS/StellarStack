import type { Meta, StoryObj } from "@storybook/react";
import UsageMetricCard from "@stellarUI/components/UsageMetricCard/UsageMetricCard";
import { DragDropGridMockProvider } from "@stellarUI/components/DragDropGrid/DragDropGridMockProvider";
import { GenerateHistory } from "../_helpers/MockData";

const meta: Meta<typeof UsageMetricCard> = {
  title: "Dashboard Cards/UsageMetricCard",
  component: UsageMetricCard,
  tags: ["autodocs"],
  decorators: [(Story) => <DragDropGridMockProvider defaultSize="sm"><Story /></DragDropGridMockProvider>],
};

export default meta;
type Story = StoryObj<typeof UsageMetricCard>;

export const RAM: Story = {
  args: {
    itemId: "ram-1",
    percentage: 62,
    usedBytes: 8_589_934_592,
    totalBytes: 17_179_869_184,
    history: GenerateHistory(30, 62, 10),
  },
};

export const Disk: Story = {
  args: {
    itemId: "disk-1",
    percentage: 78,
    usedBytes: 107_374_182_400,
    totalBytes: 137_438_953_472,
    history: GenerateHistory(30, 78, 5),
  },
};

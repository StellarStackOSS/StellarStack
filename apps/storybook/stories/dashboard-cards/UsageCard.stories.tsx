import type { Meta, StoryObj } from "@storybook/react";
import UsageCard, {
  UsageCardTitle,
  UsageCardContent,
  UsageCardFooter,
} from "@stellarUI/components/UsageCard/UsageCard";
import DragDropGridMockProvider from "@stellarUI/components/DragDropGrid/DragDropGridMockProvider";

const meta: Meta<typeof UsageCard> = {
  title: "Dashboard Cards/UsageCard",
  component: UsageCard,
  tags: ["autodocs"],
  decorators: [(Story) => <DragDropGridMockProvider defaultSize="sm"><Story /></DragDropGridMockProvider>],
};

export default meta;
type Story = StoryObj<typeof UsageCard>;

export const Default: Story = {
  args: {
    itemId: "usage-1",
    title: "Memory Usage",
    children: (
      <UsageCardContent>
        <p className="text-2xl font-bold">8.2 GB</p>
        <p className="text-sm text-muted-foreground">of 16 GB used</p>
      </UsageCardContent>
    ),
  },
};

export const WithFooter: Story = {
  render: () => (
    <UsageCard itemId="usage-2" title="Disk Usage">
      <UsageCardContent>
        <p className="text-2xl font-bold">120 GB</p>
        <p className="text-sm text-muted-foreground">of 256 GB used</p>
      </UsageCardContent>
      <UsageCardFooter>
        <p className="text-xs text-muted-foreground">Last updated 5 min ago</p>
      </UsageCardFooter>
    </UsageCard>
  ),
};

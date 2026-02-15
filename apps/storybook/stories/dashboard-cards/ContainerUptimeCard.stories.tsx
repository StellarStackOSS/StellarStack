import type { Meta, StoryObj } from "@storybook/react";
import ContainerUptimeCard from "@stellarUI/components/ContainerUptimeCard/ContainerUptimeCard";
import DragDropGridMockProvider from "@stellarUI/components/DragDropGrid/DragDropGridMockProvider";

const meta: Meta<typeof ContainerUptimeCard> = {
  title: "Dashboard Cards/ContainerUptimeCard",
  component: ContainerUptimeCard,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <DragDropGridMockProvider defaultSize="sm">
        <Story />
      </DragDropGridMockProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ContainerUptimeCard>;

export const Running: Story = {
  args: {
    itemId: "uptime-1",
    isOffline: false,
    containerUptime: 86400000,
    containerStatus: "running",
    labels: { title: "Uptime", uptime: "Uptime", status: "Status" },
  },
};

export const Stopped: Story = {
  args: {
    itemId: "uptime-2",
    isOffline: true,
    containerUptime: 0,
    containerStatus: "stopped",
    labels: { title: "Uptime", uptime: "Uptime", status: "Status" },
  },
};

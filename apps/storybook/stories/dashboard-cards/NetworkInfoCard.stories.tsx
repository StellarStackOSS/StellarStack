import type { Meta, StoryObj } from "@storybook/react";
import NetworkInfoCard from "@stellarUI/components/NetworkInfoCard/NetworkInfoCard";
import { DragDropGridMockProvider } from "@stellarUI/components/DragDropGrid/DragDropGridMockProvider";

const meta: Meta<typeof NetworkInfoCard> = {
  title: "Dashboard Cards/NetworkInfoCard",
  component: NetworkInfoCard,
  tags: ["autodocs"],
  decorators: [(Story) => <DragDropGridMockProvider defaultSize="sm"><Story /></DragDropGridMockProvider>],
};

export default meta;
type Story = StoryObj<typeof NetworkInfoCard>;

export const Default: Story = {
  args: {
    itemId: "netinfo-1",
    networkInfo: {
      primaryAddress: "192.168.1.100",
      ports: [{ port: 25565, protocol: "TCP", description: "Minecraft" }],
    },
    labels: {
      title: "Network",
      address: "Address",
      ports: "Ports",
    },
  },
};

export const MultiplePorts: Story = {
  args: {
    itemId: "netinfo-2",
    networkInfo: {
      primaryAddress: "10.0.0.50",
      ports: [
        { port: 25565, protocol: "TCP", description: "Game" },
        { port: 25575, protocol: "TCP", description: "RCON" },
        { port: 8080, protocol: "TCP", description: "Dynmap" },
      ],
    },
    labels: {
      title: "Network",
      address: "Address",
      ports: "Ports",
    },
  },
};

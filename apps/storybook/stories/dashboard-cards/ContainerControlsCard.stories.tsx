import type { Meta, StoryObj } from "@storybook/react";
import ContainerControlsCard from "@stellarUI/components/ContainerControlsCard/ContainerControlsCard";
import DragDropGridMockProvider from "@stellarUI/components/DragDropGrid/DragDropGridMockProvider";

const LABELS = {
  title: "Controls",
  start: "Start",
  stop: "Stop",
  restart: "Restart",
  kill: "Kill",
};

const meta: Meta<typeof ContainerControlsCard> = {
  title: "Dashboard Cards/ContainerControlsCard",
  component: ContainerControlsCard,
  tags: ["autodocs"],
  decorators: [(Story) => <DragDropGridMockProvider defaultSize="sm"><Story /></DragDropGridMockProvider>],
};

export default meta;
type Story = StoryObj<typeof ContainerControlsCard>;

export const Running: Story = {
  args: {
    itemId: "ctrl-1",
    isOffline: false,
    status: "running",
    onStart: () => {},
    onStop: () => {},
    onKill: () => {},
    onRestart: () => {},
    labels: LABELS,
  },
};

export const Stopped: Story = {
  args: {
    itemId: "ctrl-2",
    isOffline: true,
    status: "stopped",
    onStart: () => {},
    onStop: () => {},
    onKill: () => {},
    onRestart: () => {},
    labels: LABELS,
  },
};

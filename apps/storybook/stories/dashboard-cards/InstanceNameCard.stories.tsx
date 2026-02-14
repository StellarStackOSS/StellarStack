import type { Meta, StoryObj } from "@storybook/react";
import InstanceNameCard from "@stellarUI/components/InstanceNameCard/InstanceNameCard";
import { DragDropGridMockProvider } from "@stellarUI/components/DragDropGrid/DragDropGridMockProvider";

const LABELS = {
  title: "Controls",
  start: "Start",
  stop: "Stop",
  restart: "Restart",
  kill: "Kill",
};

const meta: Meta<typeof InstanceNameCard> = {
  title: "Dashboard Cards/InstanceNameCard",
  component: InstanceNameCard,
  tags: ["autodocs"],
  decorators: [(Story) => <DragDropGridMockProvider defaultSize="sm"><Story /></DragDropGridMockProvider>],
};

export default meta;
type Story = StoryObj<typeof InstanceNameCard>;

export const Online: Story = {
  args: {
    itemId: "inst-1",
    instanceName: "Survival Server",
    isOffline: false,
    status: "running",
    onStart: () => {},
    onStop: () => {},
    onKill: () => {},
    onRestart: () => {},
    labels: LABELS,
  },
};

export const Offline: Story = {
  args: {
    itemId: "inst-2",
    instanceName: "Creative Server",
    isOffline: true,
    status: "stopped",
    onStart: () => {},
    onStop: () => {},
    onKill: () => {},
    onRestart: () => {},
    labels: LABELS,
  },
};

export const Starting: Story = {
  args: {
    itemId: "inst-3",
    instanceName: "Modded Server",
    isOffline: false,
    status: "starting",
    onStart: () => {},
    onStop: () => {},
    onKill: () => {},
    onRestart: () => {},
    labels: LABELS,
  },
};

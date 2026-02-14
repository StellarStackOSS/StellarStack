import type { Meta, StoryObj } from "@storybook/react";
import { NetworkBar } from "@stellarUI/components/NetworkBar/NetworkBar";

const meta: Meta<typeof NetworkBar> = {
  title: "Dashboard Cards/NetworkBar",
  component: NetworkBar,
  tags: ["autodocs"],
  argTypes: {
    download: { control: { type: "number", min: 0, max: 100 } },
    upload: { control: { type: "number", min: 0, max: 100 } },
    segments: { control: { type: "number", min: 1, max: 20 } },
    compact: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof NetworkBar>;

export const Default: Story = {
  args: { download: 45, upload: 20 },
};

export const HighUsage: Story = {
  args: { download: 95, upload: 80 },
};

export const Compact: Story = {
  args: { download: 60, upload: 30, compact: true },
};

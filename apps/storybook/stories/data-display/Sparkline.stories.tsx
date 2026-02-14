import type { Meta, StoryObj } from "@storybook/react";
import { Sparkline, DualSparkline } from "@stellarUI/components/Sparkline/Sparkline";
import { GenerateHistory } from "../_helpers/MockData";

const meta: Meta<typeof Sparkline> = {
  title: "Data Display/Sparkline",
  component: Sparkline,
  tags: ["autodocs"],
  argTypes: {
    height: { control: { type: "number", min: 16, max: 100 } },
    color: { control: "color" },
  },
};

export default meta;
type Story = StoryObj<typeof Sparkline>;

export const Default: Story = {
  args: {
    data: GenerateHistory(30, 50, 20),
    height: 32,
  },
};

export const WithColor: Story = {
  args: {
    data: GenerateHistory(30, 70, 15),
    height: 48,
    color: "#f59e0b",
  },
};

export const Dual: StoryObj<typeof DualSparkline> = {
  render: () => (
    <DualSparkline
      data1={GenerateHistory(30, 40, 20)}
      data2={GenerateHistory(30, 60, 15)}
      height={48}
      color1="#3b82f6"
      color2="#a855f7"
    />
  ),
};

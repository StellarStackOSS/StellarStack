import type { Meta, StoryObj } from "@storybook/react";
import { WaveText } from "@stellarUI/components/WaveText/WaveText";

const meta: Meta<typeof WaveText> = {
  title: "Migrated/WaveText",
  component: WaveText,
  tags: ["autodocs"],
  argTypes: {
    text: { control: "text" },
    baseClassName: { control: "text" },
    highlightClassName: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof WaveText>;

export const Default: Story = {
  args: {
    text: "StellarStack V1.3.9-alpha",
    baseClassName: "text-zinc-600",
    highlightClassName: "text-zinc-100",
  },
};

export const CustomColors: Story = {
  args: {
    text: "Hello World",
    baseClassName: "text-blue-900",
    highlightClassName: "text-blue-300",
  },
};

export const LongText: Story = {
  args: {
    text: "The quick brown fox jumps over the lazy dog",
    baseClassName: "text-zinc-600",
  },
};

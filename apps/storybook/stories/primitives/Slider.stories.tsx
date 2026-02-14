import type { Meta, StoryObj } from "@storybook/react";
import Slider from "@stellarUI/components/Slider/Slider";

const meta: Meta<typeof Slider> = {
  title: "Primitives/Slider",
  component: Slider,
  tags: ["autodocs"],
  argTypes: {
    disabled: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof Slider>;

export const Default: Story = {
  args: { defaultValue: [50], max: 100, step: 1, className: "w-60" },
};

export const Range: Story = {
  args: { defaultValue: [25, 75], max: 100, step: 1, className: "w-60" },
};

export const Disabled: Story = {
  args: { defaultValue: [50], max: 100, step: 1, disabled: true, className: "w-60" },
};

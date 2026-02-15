import type { Meta, StoryObj } from "@storybook/react";
import PixelText from "@stellarUI/components/PixelText/PixelText";

const meta: Meta<typeof PixelText> = {
  title: "Specialized/PixelText",
  component: PixelText,
  tags: ["autodocs"],
  argTypes: {
    text: { control: "text" },
    letterSpacing: { control: { type: "number", min: 0, max: 20 } },
    spaceWidth: { control: { type: "number", min: 0, max: 30 } },
  },
};

export default meta;
type Story = StoryObj<typeof PixelText>;

export const Default: Story = {
  args: { text: "HELLO" },
};

export const CustomSpacing: Story = {
  args: { text: "PIXEL", letterSpacing: 8, spaceWidth: 16 },
};

export const Numbers: Story = {
  args: { text: "12345" },
};

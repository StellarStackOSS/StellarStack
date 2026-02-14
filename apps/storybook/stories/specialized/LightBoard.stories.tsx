import type { Meta, StoryObj } from "@storybook/react";
import LightBoard from "@stellarUI/components/LightBoard/LightBoard";

const meta: Meta<typeof LightBoard> = {
  title: "Specialized/LightBoard",
  component: LightBoard,
  tags: ["autodocs"],
  argTypes: {
    text: { control: "text" },
    gap: { control: { type: "number", min: 0, max: 10 } },
    rows: { control: { type: "number", min: 3, max: 20 } },
    lightSize: { control: { type: "number", min: 2, max: 10 } },
    font: { control: "select", options: ["default", "7segment"] },
    disableDrawing: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof LightBoard>;

export const Default: Story = {
  args: {
    text: "STELLAR",
    rows: 9,
    gap: 1,
    lightSize: 4,
  },
};

export const CustomSize: Story = {
  args: {
    text: "HI",
    rows: 7,
    gap: 2,
    lightSize: 6,
    font: "7segment",
  },
};

export const NoDrawing: Story = {
  args: {
    text: "DEMO",
    rows: 9,
    gap: 1,
    lightSize: 4,
    disableDrawing: true,
  },
};

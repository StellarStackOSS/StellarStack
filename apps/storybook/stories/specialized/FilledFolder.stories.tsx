import type { Meta, StoryObj } from "@storybook/react";
import FilledFolder from "@stellarUI/components/FilledFolder/FilledFolder";

const meta: Meta<typeof FilledFolder> = {
  title: "Specialized/FilledFolder",
  component: FilledFolder,
  tags: ["autodocs"],
  argTypes: {
    folderName: { control: "text" },
    folderQuantity: { control: { type: "number", min: 0, max: 100 } },
  },
};

export default meta;
type Story = StoryObj<typeof FilledFolder>;

export const Default: Story = {
  args: {
    folderName: "Documents",
    folderQuantity: 12,
  },
};

export const SingleFile: Story = {
  args: {
    folderName: "Config",
    folderQuantity: 1,
  },
};

export const ManyFiles: Story = {
  args: {
    folderName: "Downloads",
    folderQuantity: 99,
  },
};

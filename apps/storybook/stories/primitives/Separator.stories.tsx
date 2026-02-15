import type { Meta, StoryObj } from "@storybook/react";
import Separator from "@stellarUI/components/Separator/Separator";

const meta: Meta<typeof Separator> = {
  title: "Primitives/Separator",
  component: Separator,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Separator>;

export const Horizontal: Story = {
  render: () => (
    <div className="w-60">
      <div className="text-sm font-medium">Title</div>
      <Separator className="my-2" />
      <div className="text-muted-foreground text-sm">Description below the separator</div>
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div className="flex h-5 items-center space-x-4 text-sm">
      <span>Item 1</span>
      <Separator orientation="vertical" />
      <span>Item 2</span>
      <Separator orientation="vertical" />
      <span>Item 3</span>
    </div>
  ),
};

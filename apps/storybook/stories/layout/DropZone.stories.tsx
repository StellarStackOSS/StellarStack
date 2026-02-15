import type { Meta, StoryObj } from "@storybook/react";
import { DropZone } from "@stellarUI/components/DropZone/DropZone";

const meta: Meta<typeof DropZone> = {
  title: "Layout/DropZone",
  component: DropZone,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof DropZone>;

export const Default: Story = {
  render: () => (
    <DropZone onDrop={(files) => console.log("Dropped:", files)}>
      <div className="flex h-[200px] w-[400px] items-center justify-center rounded-lg border-2 border-dashed border-border p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Drag and drop files here, or click to browse
        </p>
      </div>
    </DropZone>
  ),
};

export const Disabled: Story = {
  render: () => (
    <DropZone onDrop={() => {}} disabled>
      <div className="flex h-[200px] w-[400px] items-center justify-center rounded-lg border-2 border-dashed border-border p-6 text-center opacity-50">
        <p className="text-sm text-muted-foreground">Upload disabled</p>
      </div>
    </DropZone>
  ),
};

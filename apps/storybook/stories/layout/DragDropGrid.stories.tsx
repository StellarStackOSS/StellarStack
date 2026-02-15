import type { Meta, StoryObj } from "@storybook/react";
import DragDropGridMockProvider from "@stellarUI/components/DragDropGrid/DragDropGridMockProvider";

const meta: Meta<typeof DragDropGridMockProvider> = {
  title: "Layout/DragDropGrid",
  component: DragDropGridMockProvider,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof DragDropGridMockProvider>;

export const MockProvider: Story = {
  render: () => (
    <DragDropGridMockProvider defaultSize="sm">
      <div className="rounded-lg border border-border bg-card p-6">
        <p className="text-sm text-foreground">
          Content inside DragDropGridMockProvider (size: sm)
        </p>
      </div>
    </DragDropGridMockProvider>
  ),
};

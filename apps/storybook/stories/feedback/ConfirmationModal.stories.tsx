import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import ConfirmationModal from "@stellarUI/components/ConfirmationModal/ConfirmationModal";
import Button from "@stellarUI/components/Button/Button";

const meta: Meta<typeof ConfirmationModal> = {
  title: "Feedback/ConfirmationModal",
  component: ConfirmationModal,
  tags: ["autodocs"],
  argTypes: {
    isLoading: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof ConfirmationModal>;

export const Interactive: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Delete Item</Button>
        <ConfirmationModal
          open={open}
          onOpenChange={setOpen}
          title="Delete Item"
          description="Are you sure you want to delete this item? This action cannot be undone."
          confirmLabel="Delete"
          onConfirm={() => setOpen(false)}
        />
      </>
    );
  },
};

export const Open: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
    title: "Confirm Action",
    description: "Are you sure you want to proceed?",
    onConfirm: () => {},
  },
};

export const Loading: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
    title: "Processing",
    description: "Please wait while we process your request.",
    onConfirm: () => {},
    isLoading: true,
  },
};

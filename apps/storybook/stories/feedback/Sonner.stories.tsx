import type { Meta, StoryObj } from "@storybook/react";
import { Toaster } from "@stellarUI/components/Sonner/Sonner";
import Button from "@stellarUI/components/Button/Button";
import { toast } from "sonner";

const meta: Meta<typeof Toaster> = {
  title: "Feedback/Sonner",
  component: Toaster,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <>
        <Story />
        <Toaster />
      </>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Toaster>;

export const Success: Story = {
  render: () => <Button onClick={() => toast.success("Operation successful!")}>Show Success</Button>,
};

export const Error: Story = {
  render: () => <Button onClick={() => toast.error("Something went wrong!")}>Show Error</Button>,
};

export const Info: Story = {
  render: () => <Button onClick={() => toast.info("Here is some information.")}>Show Info</Button>,
};

export const WithAction: Story = {
  render: () => (
    <Button
      onClick={() =>
        toast("Event created", {
          description: "Your event has been scheduled.",
          action: { label: "Undo", onClick: () => console.log("Undo") },
        })
      }
    >
      Show with Action
    </Button>
  ),
};

import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import FormModal from "@stellarUI/components/FormModal/FormModal";
import Button from "@stellarUI/components/Button/Button";
import Input from "@stellarUI/components/Input/Input";
import Label from "@stellarUI/components/Label/Label";

const meta: Meta<typeof FormModal> = {
  title: "Feedback/FormModal",
  component: FormModal,
  tags: ["autodocs"],
  argTypes: {
    isLoading: { control: "boolean" },
    size: {
      control: "select",
      options: ["sm", "md", "lg", "xl", "2xl", "3xl"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof FormModal>;

export const Interactive: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Create Item</Button>
        <FormModal
          open={open}
          onOpenChange={setOpen}
          title="Create New Item"
          description="Fill in the details below."
          submitLabel="Create"
          onSubmit={() => setOpen(false)}
        >
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="item-name">Name</Label>
              <Input id="item-name" placeholder="Item name" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="item-desc">Description</Label>
              <Input id="item-desc" placeholder="Description" />
            </div>
          </div>
        </FormModal>
      </>
    );
  },
};

export const WithFields: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
    title: "Edit Settings",
    description: "Update your configuration.",
    onSubmit: () => {},
    children: (
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="host">Host</Label>
          <Input id="host" defaultValue="localhost" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="port">Port</Label>
          <Input id="port" type="number" defaultValue="3000" />
        </div>
      </div>
    ),
  },
};

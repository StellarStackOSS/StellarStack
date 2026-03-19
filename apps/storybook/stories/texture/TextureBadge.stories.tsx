import type { Meta, StoryObj } from "@storybook/react";
import TextureBadge from "@stellarUI/components/TextureBadge/TextureBadge";

const meta: Meta<typeof TextureBadge> = {
  title: "Texture/TextureBadge",
  component: TextureBadge,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "accent", "destructive", "success", "warning", "ghost"],
    },
    size: {
      control: "select",
      options: ["sm", "default", "lg"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof TextureBadge>;

export const Default: Story = {
  args: { children: "Badge" },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <TextureBadge variant="primary">Primary</TextureBadge>
      <TextureBadge variant="secondary">Secondary</TextureBadge>
      <TextureBadge variant="accent">Accent</TextureBadge>
      <TextureBadge variant="destructive">Destructive</TextureBadge>
      <TextureBadge variant="success">Success</TextureBadge>
      <TextureBadge variant="warning">Warning</TextureBadge>
      <TextureBadge variant="ghost">Ghost</TextureBadge>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <TextureBadge size="sm">Small</TextureBadge>
      <TextureBadge size="default">Default</TextureBadge>
      <TextureBadge size="lg">Large</TextureBadge>
    </div>
  ),
};

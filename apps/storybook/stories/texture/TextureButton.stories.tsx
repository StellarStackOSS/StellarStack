import type { Meta, StoryObj } from "@storybook/react";
import { TextureButton } from "@stellarUI/components/TextureButton";
import { Plus, Settings, Trash2, Check } from "lucide-react";

const meta: Meta<typeof TextureButton> = {
  title: "Texture/TextureButton",
  component: TextureButton,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "accent", "destructive", "minimal", "icon", "ghost", "success", "warning"],
    },
    size: {
      control: "select",
      options: ["default", "sm", "lg", "icon"],
    },
    disabled: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof TextureButton>;

export const Default: Story = {
  args: { children: "Texture Button" },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <TextureButton variant="primary">Primary</TextureButton>
      <TextureButton variant="secondary">Secondary</TextureButton>
      <TextureButton variant="accent">Accent</TextureButton>
      <TextureButton variant="destructive">Destructive</TextureButton>
      <TextureButton variant="minimal">Minimal</TextureButton>
      <TextureButton variant="ghost">Ghost</TextureButton>
      <TextureButton variant="success">Success</TextureButton>
      <TextureButton variant="warning">Warning</TextureButton>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <TextureButton size="sm">Small</TextureButton>
      <TextureButton size="default">Default</TextureButton>
      <TextureButton size="lg">Large</TextureButton>
      <TextureButton size="icon"><Plus /></TextureButton>
    </div>
  ),
};

export const WithIcons: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <TextureButton variant="primary"><Plus className="h-4 w-4" /> Create</TextureButton>
      <TextureButton variant="secondary"><Settings className="h-4 w-4" /> Settings</TextureButton>
      <TextureButton variant="destructive"><Trash2 className="h-4 w-4" /> Delete</TextureButton>
      <TextureButton variant="success"><Check className="h-4 w-4" /> Save</TextureButton>
    </div>
  ),
};

export const IconOnly: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <TextureButton size="icon" variant="primary"><Plus /></TextureButton>
      <TextureButton size="icon" variant="secondary"><Settings /></TextureButton>
      <TextureButton size="icon" variant="destructive"><Trash2 /></TextureButton>
    </div>
  ),
};

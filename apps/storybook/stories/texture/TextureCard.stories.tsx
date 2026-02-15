import type { Meta, StoryObj } from "@storybook/react";
import {
  TextureCard,
  TextureCardContent,
  TextureCardHeader,
  TextureCardTitle,
  TextureCardFooter,
} from "@stellarUI/components/TextureCard";
import { TextureButton } from "@stellarUI/components/TextureButton";

const meta: Meta<typeof TextureCard> = {
  title: "Texture/TextureCard",
  component: TextureCard,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof TextureCard>;

export const Default: Story = {
  render: () => (
    <TextureCard className="w-[350px]">
      <TextureCardContent className="p-6">
        <p className="text-muted-foreground text-sm">Simple texture card with content.</p>
      </TextureCardContent>
    </TextureCard>
  ),
};

export const WithHeader: Story = {
  render: () => (
    <TextureCard className="w-[350px]">
      <TextureCardHeader>
        <TextureCardTitle>Card Title</TextureCardTitle>
      </TextureCardHeader>
      <TextureCardContent>
        <p className="text-muted-foreground text-sm">Card body content goes here.</p>
      </TextureCardContent>
    </TextureCard>
  ),
};

export const WithFooter: Story = {
  render: () => (
    <TextureCard className="w-[350px]">
      <TextureCardHeader>
        <TextureCardTitle>Settings</TextureCardTitle>
      </TextureCardHeader>
      <TextureCardContent>
        <p className="text-muted-foreground text-sm">Manage your preferences.</p>
      </TextureCardContent>
      <TextureCardFooter className="flex justify-end gap-2">
        <TextureButton variant="ghost" size="sm">
          Cancel
        </TextureButton>
        <TextureButton variant="primary" size="sm">
          Save
        </TextureButton>
      </TextureCardFooter>
    </TextureCard>
  ),
};

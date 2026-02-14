import type { Meta, StoryObj } from "@storybook/react";
import { InfoTooltip, InfoRow } from "@stellarUI/components/InfoTooltip/InfoTooltip";
import { TooltipProvider } from "@stellarUI/components/Tooltip/Tooltip";

const meta: Meta<typeof InfoTooltip> = {
  title: "Specialized/InfoTooltip",
  component: InfoTooltip,
  tags: ["autodocs"],
  decorators: [(Story) => <TooltipProvider><Story /></TooltipProvider>],
  argTypes: {
    visible: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof InfoTooltip>;

export const Default: Story = {
  args: {
    content: (
      <div className="space-y-1">
        <InfoRow label="CPU" value="45%" />
        <InfoRow label="Memory" value="8.2 GB" />
        <InfoRow label="Disk" value="120 GB" />
      </div>
    ),
  },
};

export const SimpleText: Story = {
  args: {
    content: "This is a helpful tooltip message.",
  },
};

import type { Meta, StoryObj } from "@storybook/react";
import Console from "@stellarUI/components/Console/Console";
import { GenerateConsoleLines } from "../_helpers/MockData";

const meta: Meta<typeof Console> = {
  title: "Specialized/Console",
  component: Console,
  tags: ["autodocs"],
  argTypes: {
    isOffline: { control: "boolean" },
    showSendButton: { control: "boolean" },
    maxLines: { control: { type: "number", min: 10, max: 500 } },
  },
};

export default meta;
type Story = StoryObj<typeof Console>;

export const Default: Story = {
  args: {
    lines: GenerateConsoleLines(20),
    className: "h-[400px] w-[600px]",
  },
};

export const WithSendButton: Story = {
  args: {
    lines: GenerateConsoleLines(15),
    showSendButton: true,
    onCommand: (cmd: string) => console.log("Command:", cmd),
    className: "h-[400px] w-[600px]",
  },
};

export const Offline: Story = {
  args: {
    lines: [],
    isOffline: true,
    className: "h-[400px] w-[600px]",
  },
};

export const Empty: Story = {
  args: {
    lines: [],
    className: "h-[400px] w-[600px]",
  },
};

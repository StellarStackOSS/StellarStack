import type { Meta, StoryObj } from "@storybook/react";
import { FadeIn } from "@stellarUI/components/FadeIn/FadeIn";

const meta: Meta<typeof FadeIn> = {
  title: "Layout/FadeIn",
  component: FadeIn,
  tags: ["autodocs"],
  argTypes: {
    direction: {
      control: "select",
      options: ["up", "down", "left", "right", "none"],
    },
    delay: { control: { type: "number", min: 0, max: 2000 } },
    duration: { control: { type: "number", min: 100, max: 2000 } },
  },
};

export default meta;
type Story = StoryObj<typeof FadeIn>;

export const Default: Story = {
  args: {
    children: (
      <div className="rounded-lg border border-border bg-card p-6">
        <p className="text-foreground">This content fades in</p>
      </div>
    ),
  },
};

export const WithDelay: Story = {
  args: {
    delay: 500,
    children: (
      <div className="rounded-lg border border-border bg-card p-6">
        <p className="text-foreground">Delayed fade in (500ms)</p>
      </div>
    ),
  },
};

export const Stagger: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      {[0, 100, 200, 300, 400].map((delay) => (
        <FadeIn key={delay} delay={delay} direction="left">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-foreground">Delay: {delay}ms</p>
          </div>
        </FadeIn>
      ))}
    </div>
  ),
};

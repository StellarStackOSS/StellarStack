import type { Meta, StoryObj } from "@storybook/react";
import { AnimatedNumber } from "@stellarUI/components/AnimatedNumber/AnimatedNumber";
import { useState } from "react";
import Button from "@stellarUI/components/Button/Button";

const meta: Meta<typeof AnimatedNumber> = {
  title: "Data Display/AnimatedNumber",
  component: AnimatedNumber,
  tags: ["autodocs"],
  argTypes: {
    value: { control: { type: "number" } },
    duration: { control: { type: "number", min: 100, max: 2000 } },
    decimals: { control: { type: "number", min: 0, max: 4 } },
    prefix: { control: "text" },
    suffix: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof AnimatedNumber>;

export const Default: Story = {
  args: { value: 1234, className: "text-2xl font-bold" },
};

export const Counting: Story = {
  render: () => {
    const [value, setValue] = useState(0);
    return (
      <div className="flex flex-col items-center gap-4">
        <AnimatedNumber value={value} className="text-4xl font-bold" suffix="%" />
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setValue((v) => v + 10)}>
            +10
          </Button>
          <Button size="sm" onClick={() => setValue((v) => Math.max(0, v - 10))}>
            -10
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setValue(Math.round(Math.random() * 100))}
          >
            Random
          </Button>
        </div>
      </div>
    );
  },
};

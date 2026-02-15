import type { Meta, StoryObj } from "@storybook/react";
import Command, {
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@stellarUI/components/Command/Command";
import { Settings, User, CreditCard } from "lucide-react";

const meta: Meta<typeof Command> = {
  title: "Navigation/Command",
  component: Command,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Command>;

export const Default: Story = {
  render: () => (
    <Command className="border-border w-[400px] rounded-lg border shadow-md">
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Suggestions">
          <CommandItem>
            <User className="mr-2 h-4 w-4" /> Profile
          </CommandItem>
          <CommandItem>
            <CreditCard className="mr-2 h-4 w-4" /> Billing
          </CommandItem>
          <CommandItem>
            <Settings className="mr-2 h-4 w-4" /> Settings
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  ),
};

export const WithGroups: Story = {
  render: () => (
    <Command className="border-border w-[400px] rounded-lg border shadow-md">
      <CommandInput placeholder="Search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Account">
          <CommandItem>
            <User className="mr-2 h-4 w-4" /> Profile
          </CommandItem>
          <CommandItem>
            <CreditCard className="mr-2 h-4 w-4" /> Billing
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Settings">
          <CommandItem>
            <Settings className="mr-2 h-4 w-4" /> General
          </CommandItem>
          <CommandItem>
            <Settings className="mr-2 h-4 w-4" /> Security
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  ),
};

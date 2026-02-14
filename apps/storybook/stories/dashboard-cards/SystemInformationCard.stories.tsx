import type { Meta, StoryObj } from "@storybook/react";
import SystemInformationCard from "@stellarUI/components/SystemInformationCard/SystemInformationCard";
import { DragDropGridMockProvider } from "@stellarUI/components/DragDropGrid/DragDropGridMockProvider";

const meta: Meta<typeof SystemInformationCard> = {
  title: "Dashboard Cards/SystemInformationCard",
  component: SystemInformationCard,
  tags: ["autodocs"],
  decorators: [(Story) => <DragDropGridMockProvider defaultSize="sm"><Story /></DragDropGridMockProvider>],
};

export default meta;
type Story = StoryObj<typeof SystemInformationCard>;

export const Default: Story = {
  args: {
    itemId: "sysinfo-1",
    nodeData: {
      os: "Ubuntu 22.04 LTS",
      kernel: "5.15.0-91-generic",
      arch: "x86_64",
      hostname: "node-01",
      cpuModel: "AMD Ryzen 9 5900X",
      cpuCores: 12,
      totalMemory: 34_359_738_368,
      totalDisk: 1_099_511_627_776,
    },
    labels: {
      title: "System Information",
      os: "OS",
      kernel: "Kernel",
      arch: "Architecture",
      hostname: "Hostname",
      cpu: "CPU",
      cores: "Cores",
      memory: "Memory",
      disk: "Disk",
    },
  },
};

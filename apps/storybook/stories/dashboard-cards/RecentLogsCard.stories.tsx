import type { Meta, StoryObj } from "@storybook/react";
import RecentLogsCard from "@stellarUI/components/RecentLogsCard/RecentLogsCard";
import DragDropGridMockProvider from "@stellarUI/components/DragDropGrid/DragDropGridMockProvider";

const MOCK_LOGS = [
  { level: "info", message: "Server started successfully", time: "12:00:01" },
  { level: "warn", message: "High memory usage detected", time: "12:00:05" },
  { level: "error", message: "Failed to load chunk", time: "12:00:10" },
  { level: "info", message: "Player Steve joined", time: "12:00:15" },
  { level: "info", message: "Auto-save complete", time: "12:00:30" },
];

const meta: Meta<typeof RecentLogsCard> = {
  title: "Dashboard Cards/RecentLogsCard",
  component: RecentLogsCard,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <DragDropGridMockProvider defaultSize="sm">
        <Story />
      </DragDropGridMockProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof RecentLogsCard>;

export const WithLogs: Story = {
  args: {
    itemId: "logs-1",
    isOffline: false,
    logs: MOCK_LOGS,
    labels: { title: "Recent Logs", noLogs: "No logs available" },
  },
};

export const Empty: Story = {
  args: {
    itemId: "logs-2",
    isOffline: false,
    logs: [],
    labels: { title: "Recent Logs", noLogs: "No logs available" },
  },
};

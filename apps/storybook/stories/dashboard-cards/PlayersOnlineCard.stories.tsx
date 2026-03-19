import type { Meta, StoryObj } from "@storybook/react";
import PlayersOnlineCard from "@stellarUI/components/PlayersOnlineCard/PlayersOnlineCard";
import DragDropGridMockProvider from "@stellarUI/components/DragDropGrid/DragDropGridMockProvider";

const MOCK_PLAYERS = [
  { id: "1", name: "Steve", joinedAt: Date.now() - 3600000 },
  { id: "2", name: "Alex", joinedAt: Date.now() - 1800000 },
  { id: "3", name: "Notch", joinedAt: Date.now() - 600000 },
];

const meta: Meta<typeof PlayersOnlineCard> = {
  title: "Dashboard Cards/PlayersOnlineCard",
  component: PlayersOnlineCard,
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
type Story = StoryObj<typeof PlayersOnlineCard>;

export const WithPlayers: Story = {
  args: {
    itemId: "players-1",
    isOffline: false,
    players: MOCK_PLAYERS,
    maxPlayers: 20,
    containerStatus: "running",
    labels: {
      title: "Players Online",
      players: "Players",
      max: "Max",
      noPlayers: "No players online",
    },
  },
};

export const Empty: Story = {
  args: {
    itemId: "players-2",
    isOffline: false,
    players: [],
    maxPlayers: 20,
    containerStatus: "running",
    labels: {
      title: "Players Online",
      players: "Players",
      max: "Max",
      noPlayers: "No players online",
    },
  },
};

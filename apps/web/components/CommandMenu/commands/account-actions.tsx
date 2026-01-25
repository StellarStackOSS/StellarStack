import { Command, CommandContext } from "./types";
import { Settings, Inbox, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/auth-provider/auth-provider";

/**
 * Account commands for user profile and authentication
 * Includes account settings, notifications, and logout
 */
export const accountActionCommands: Command[] = [
  {
    id: "account-settings",
    label: "Account Settings",
    description: "Manage your account settings",
    icon: <Settings className="size-4" />,
    category: "account",
    type: "simple",
    isAvailable: () => true,
    action: { navigate: "/account" },
    keywords: ["account", "settings", "profile"],
    priority: 60,
  },
  {
    id: "account-notifications",
    label: "Notifications",
    description: "View and manage notifications",
    icon: <Inbox className="size-4" />,
    category: "account",
    type: "simple",
    isAvailable: () => true,
    action: { navigate: "/account/notifications" },
    keywords: ["notifications", "inbox", "messages"],
    priority: 59,
  },
  {
    id: "account-logout",
    label: "Sign Out",
    description: "Sign out of your account",
    icon: <LogOut className="size-4" />,
    category: "account",
    type: "simple",
    isAvailable: () => true,
    action: {
      onClick: async () => {
        // This will be handled specially in the UI
        // We can't use useAuth here, so the UI will need to handle this
      },
    },
    keywords: ["logout", "signout", "exit"],
    priority: 1, // Low priority
  },
];

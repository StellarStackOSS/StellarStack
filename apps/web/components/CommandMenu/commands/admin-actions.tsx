import { Command, CommandContext } from "./types";
import { Plus, Users, Server, Database, BarChart3 } from "lucide-react";

/**
 * Admin-only commands for managing servers, users, nodes, and system settings
 * Only available to users with admin role
 */
export const adminActionCommands: Command[] = [
  {
    id: "admin-create-server",
    label: "Create Server",
    description: "Create a new server",
    icon: <Plus className="size-4" />,
    category: "admin",
    type: "form",
    isAvailable: (ctx: CommandContext) => ctx.isAdmin,
    action: {
      openForm: (ctx: CommandContext) => {
        // This will be handled by the UI
      },
    },
    keywords: ["create", "server", "new"],
    priority: 70,
  },
  {
    id: "admin-create-user",
    label: "Create User",
    description: "Create a new user account",
    icon: <Plus className="size-4" />,
    category: "admin",
    type: "form",
    isAvailable: (ctx: CommandContext) => ctx.isAdmin,
    action: {
      openForm: (ctx: CommandContext) => {
        // This will be handled by the UI
      },
    },
    keywords: ["create", "user", "new", "account"],
    priority: 69,
  },
  {
    id: "admin-create-node",
    label: "Create Node",
    description: "Add a new node",
    icon: <Plus className="size-4" />,
    category: "admin",
    type: "form",
    isAvailable: (ctx: CommandContext) => ctx.isAdmin,
    action: {
      openForm: (ctx: CommandContext) => {
        // This will be handled by the UI
      },
    },
    keywords: ["create", "node", "new"],
    priority: 68,
  },
  {
    id: "admin-view-servers",
    label: "View All Servers",
    description: "List all servers in the system",
    icon: <Server className="size-4" />,
    category: "admin",
    type: "simple",
    isAvailable: (ctx: CommandContext) => ctx.isAdmin,
    action: { navigate: "/admin/servers" },
    keywords: ["view", "servers", "list"],
    priority: 65,
  },
  {
    id: "admin-view-users",
    label: "View All Users",
    description: "List all users in the system",
    icon: <Users className="size-4" />,
    category: "admin",
    type: "simple",
    isAvailable: (ctx: CommandContext) => ctx.isAdmin,
    action: { navigate: "/admin/users" },
    keywords: ["view", "users", "list"],
    priority: 64,
  },
  {
    id: "admin-view-nodes",
    label: "View All Nodes",
    description: "List all nodes in the system",
    icon: <Database className="size-4" />,
    category: "admin",
    type: "simple",
    isAvailable: (ctx: CommandContext) => ctx.isAdmin,
    action: { navigate: "/admin/nodes" },
    keywords: ["view", "nodes", "list"],
    priority: 63,
  },
  {
    id: "admin-analytics",
    label: "View Analytics",
    description: "View system analytics and statistics",
    icon: <BarChart3 className="size-4" />,
    category: "admin",
    type: "simple",
    isAvailable: (ctx: CommandContext) => ctx.isAdmin,
    action: { navigate: "/admin/analytics" },
    keywords: ["analytics", "stats", "dashboard"],
    priority: 62,
  },
];

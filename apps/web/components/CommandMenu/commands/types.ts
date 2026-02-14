import { ReactNode } from "react";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { Server } from "@/lib/Api";

/** Category types for command grouping */
export type CommandCategory =
  | "navigation"
  | "server-power"
  | "server-management"
  | "admin"
  | "account"
  | "recent";

/** Types of commands defining how they execute */
export type CommandType = "simple" | "form" | "submenu" | "search";

/**
 * Context passed to command handlers containing current app state
 */
export interface CommandContext {
  /** Current server ID if on server page */
  serverId?: string;
  /** Current server object if available */
  server?: Server | null;
  /** Whether current user is admin */
  isAdmin: boolean;
  /** User's permissions */
  permissions: string[];
  /** Current pathname */
  pathname: string;
  /** Next router instance */
  router: AppRouterInstance;
  /** Current user ID */
  userId?: string;
}

/**
 * Action to execute when command is selected
 */
export interface CommandAction {
  /** Navigate to URL (can be static or dynamic) */
  navigate?: string | ((ctx: CommandContext) => string);
  /** Execute callback function */
  onClick?: () => void | Promise<void>;
  /** Open form modal */
  openForm?: (ctx: CommandContext) => void;
  /** Make API call with optional confirmation */
  apiCall?: {
    handler: (ctx: CommandContext) => Promise<void>;
    confirmation?: { title: string; description: string };
  };
}

/**
 * Command definition
 */
export interface Command {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Description shown in palette */
  description?: string;
  /** Icon component */
  icon?: ReactNode;
  /** Category for grouping */
  category: CommandCategory;
  /** How the command executes */
  type: CommandType;
  /** Keyboard shortcut (e.g., ['g', 's']) */
  shortcut?: string[];
  /** Function to check if command should be available */
  isAvailable: (context: CommandContext) => boolean;
  /** Action to perform */
  action: CommandAction;
  /** Keywords for search */
  keywords?: string[];
  /** Sort priority (higher = shown first) */
  priority?: number;
}

/**
 * Command menu state
 */
export interface CommandMenuState {
  /** Whether menu is open */
  isOpen: boolean;
  /** Current search query */
  search: string;
  /** Recently executed commands */
  recentCommands: Command[];
  /** Currently active form modal */
  activeForm?: {
    type: string;
    context?: CommandContext;
  };
}

/**
 * Context type for command menu
 */
export interface CommandMenuContextType {
  /** Current state */
  state: CommandMenuState;
  /** Open the command menu */
  open: () => void;
  /** Close the command menu */
  close: () => void;
  /** Open a form modal */
  openForm: (formType: string, context: CommandContext) => void;
  /** Close the form modal */
  closeForm: () => void;
}

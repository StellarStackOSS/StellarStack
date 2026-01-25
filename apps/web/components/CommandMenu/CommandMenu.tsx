"use client";

import { useEffect, useState, useMemo } from "react";
import { useCommandMenu } from "./hooks/useCommandMenu";
import { useCommandContext } from "./hooks/useCommandContext";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from "@workspace/ui/components/command";
import { ConfirmationModal } from "@workspace/ui/components/confirmation-modal";
import {
  Command,
  CommandContext,
  type CommandMenuState,
} from "./commands/types";
import { navigationCommands } from "./commands/navigation";
import { serverActionCommands } from "./commands/server-actions";
import { adminActionCommands } from "./commands/admin-actions";
import { accountActionCommands } from "./commands/account-actions";
import { CommandForms } from "./CommandForms";
import { useAuth } from "@/hooks/auth-provider/auth-provider";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/**
 * Main command palette component
 * Displays searchable command menu with context-aware filtering
 */
export const CommandMenu = () => {
  const { state, close, openForm } = useCommandMenu();
  const context = useCommandContext();
  const { signOut } = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    command?: Command;
    title: string;
    description: string;
  }>({
    isOpen: false,
    title: "",
    description: "",
  });

  // Get available commands based on context
  const availableCommands = useMemo(() => {
    const allCommands = [
      ...navigationCommands,
      ...serverActionCommands,
      ...adminActionCommands,
      ...accountActionCommands,
    ];
    return allCommands
      .filter((command) => command.isAvailable(context))
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }, [context]);

  // Filter commands by search query
  const filteredCommands = useMemo(() => {
    if (!search) return availableCommands;

    const query = search.toLowerCase();
    return availableCommands.filter((cmd) => {
      return (
        cmd.label.toLowerCase().includes(query) ||
        cmd.description?.toLowerCase().includes(query) ||
        cmd.keywords?.some((k) => k.toLowerCase().includes(query))
      );
    });
  }, [search, availableCommands]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, Command[]> = {
      recent: [],
      navigation: [],
      "server-power": [],
      "server-management": [],
      admin: [],
      account: [],
    };

    // Add recent commands if no search
    if (!search && state.recentCommands.length > 0) {
      groups.recent = state.recentCommands;
    }

    // Sort filtered commands into groups
    filteredCommands.forEach((cmd) => {
      if (cmd.category in groups) {
        (groups[cmd.category as keyof typeof groups] as Command[]).push(cmd);
      }
    });

    return groups;
  }, [filteredCommands, search, state.recentCommands]);

  /**
   * Format shortcut keys for display
   */
  const formatShortcut = (keys?: string[]) => {
    if (!keys) return "";
    return keys.join(" ");
  };

  /**
   * Track command in recent commands
   */
  const trackRecentCommand = (command: Command) => {
    try {
      // Get current recent commands from state
      const updated = [command, ...state.recentCommands.filter((c) => c.id !== command.id)].slice(
        0,
        5
      );
      localStorage.setItem("commandMenuRecent", JSON.stringify(updated));
    } catch (error) {
      console.error("Failed to save recent commands:", error);
    }
  };

  /**
   * Execute a command with confirmation if needed
   */
  const handleSelectCommand = async (command: Command) => {
    // Track command in recent
    trackRecentCommand(command);

    // Handle logout specially
    if (command.id === "account-logout") {
      close();
      await signOut();
      return;
    }

    // Handle form-type commands
    if (command.type === "form") {
      openForm(command.id, context);
      close();
      return;
    }

    // Handle API calls with confirmation
    if (command.action.apiCall) {
      if (command.action.apiCall.confirmation) {
        setConfirmDialog({
          isOpen: true,
          command,
          title: command.action.apiCall.confirmation.title,
          description: command.action.apiCall.confirmation.description,
        });
        return;
      }

      try {
        await command.action.apiCall.handler(context);
        toast.success(`${command.label} completed`);
        close();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Action failed");
      }
      return;
    }

    // Handle navigation
    if (command.action.navigate) {
      const path =
        typeof command.action.navigate === "function"
          ? command.action.navigate(context)
          : command.action.navigate;
      router.push(path);
      close();
      return;
    }

    // Handle simple onClick
    if (command.action.onClick) {
      try {
        await command.action.onClick();
        close();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Action failed");
      }
    }
  };

  /**
   * Handle confirmed API call
   */
  const handleConfirmAction = async () => {
    if (!confirmDialog.command?.action.apiCall) return;

    try {
      await confirmDialog.command.action.apiCall.handler(context);
      toast.success(`${confirmDialog.command.label} completed`);
      close();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setConfirmDialog({ isOpen: false, title: "", description: "" });
    }
  };

  /**
   * Category labels for display
   */
  const categoryLabels: Record<string, string> = {
    recent: "Recent",
    navigation: "Navigation",
    "server-power": "Server Power",
    "server-management": "Server Management",
    admin: "Admin",
    account: "Account",
  };

  return (
    <>
      <CommandDialog open={state.isOpen} onOpenChange={close}>
        <CommandInput
          placeholder="Search commands..."
          value={search}
          onValueChange={setSearch}
        />
        <CommandList>
          {filteredCommands.length === 0 && (
            <CommandEmpty>No commands found.</CommandEmpty>
          )}

          {Object.entries(groupedCommands).map(([category, commands]) => {
            if (commands.length === 0) return null;

            return (
              <CommandGroup
                key={category}
                heading={categoryLabels[category] || category}
              >
                {commands.map((command) => (
                  <CommandItem
                    key={command.id}
                    value={command.id}
                    onSelect={() => handleSelectCommand(command)}
                  >
                    {command.icon}
                    <div className="flex flex-1 flex-col gap-0.5">
                      <span>{command.label}</span>
                      {command.description && (
                        <span className="text-xs text-muted-foreground">
                          {command.description}
                        </span>
                      )}
                    </div>
                    {command.shortcut && (
                      <CommandShortcut>{formatShortcut(command.shortcut)}</CommandShortcut>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}
        </CommandList>
      </CommandDialog>

      <ConfirmationModal
        open={confirmDialog.isOpen}
        onOpenChange={(open) => {
          if (!open) setConfirmDialog({ isOpen: false, title: "", description: "" });
        }}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmLabel="Confirm"
        cancelLabel="Cancel"
        onConfirm={handleConfirmAction}
      />

      <CommandForms />
    </>
  );
};

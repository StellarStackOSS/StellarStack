"use client";

import { createContext, useState, useEffect, useCallback, ReactNode } from "react";
import { Command, CommandMenuState, CommandMenuContextType } from "./commands/types";

/** Context for command menu state and methods */
export const CommandMenuContext = createContext<CommandMenuContextType | undefined>(undefined);

/** Props for CommandMenuProvider component */
interface CommandMenuProviderProps {
  children: ReactNode;
}

/**
 * Provider component for command menu functionality
 * Manages global state for command palette
 * @param children React nodes to wrap with command menu context
 */
export const CommandMenuProvider = ({ children }: CommandMenuProviderProps) => {
  const [state, setState] = useState<CommandMenuState>({
    isOpen: false,
    search: "",
    recentCommands: [],
    activeForm: undefined,
  });

  // Load recent commands from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("commandMenuRecent");
      if (stored) {
        const commands = JSON.parse(stored) as Command[];
        setState((prev) => ({ ...prev, recentCommands: commands }));
      }
    } catch (error) {
      console.error("Failed to load recent commands:", error);
    }
  }, []);

  // Handle Cmd/Ctrl+K to open command menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setState((prev) => ({ ...prev, isOpen: !prev.isOpen }));
      }

      // Close on Escape
      if (e.key === "Escape") {
        setState((prev) => ({ ...prev, isOpen: false }));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const open = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: true }));
  }, []);

  const close = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false, search: "" }));
  }, []);

  const openForm = useCallback((formType: string, context: any) => {
    setState((prev) => ({
      ...prev,
      activeForm: { type: formType, context },
    }));
  }, []);

  const closeForm = useCallback(() => {
    setState((prev) => ({
      ...prev,
      activeForm: undefined,
    }));
  }, []);

  const value: CommandMenuContextType = {
    state,
    open,
    close,
    openForm,
    closeForm,
  };

  return <CommandMenuContext.Provider value={value}>{children}</CommandMenuContext.Provider>;
};

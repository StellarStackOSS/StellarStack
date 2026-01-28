"use client";

import { useContext } from "react";
import { CommandMenuContext } from "@/components/CommandMenu/CommandMenuProvider";
import { CommandMenuContextType } from "@/components/CommandMenu/commands/types";

/**
 * Hook to access command menu state and methods
 * Must be used within CommandMenuProvider
 * @returns Command menu context with state and action methods
 * @throws Error if used outside CommandMenuProvider
 */
export const useCommandMenu = (): CommandMenuContextType => {
  const context = useContext(CommandMenuContext);
  if (!context) {
    throw new Error("useCommandMenu must be used within CommandMenuProvider");
  }
  return context;
};

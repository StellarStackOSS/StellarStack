"use client";

import type { JSX, ReactNode } from "react";
import { DragDropGridContext } from "./DragDropGrid";
import type { DragDropGridContextValue, GridSize } from "./types";

/**
 * Props for the DragDropGridMockProvider component.
 */
interface DragDropGridMockProviderProps {
  /** The content to render inside the mock grid context */
  children: ReactNode;
  /** The default size to return for all items (defaults to "sm") */
  defaultSize?: GridSize;
}

/**
 * Lightweight mock provider that supplies a static DragDropGridContextValue.
 * Allows dashboard cards (CpuCard, UsageMetricCard, NetworkUsageCard) to render
 * outside a real DragDropGrid without depending on react-grid-layout.
 *
 * @component
 * @example
 * ```tsx
 * <DragDropGridMockProvider defaultSize="sm">
 *   <CpuCard itemId="cpu" percentage={45} ... />
 * </DragDropGridMockProvider>
 * ```
 *
 * @param props - Mock provider configuration
 * @returns Provider wrapping children with a static grid context
 */
const DragDropGridMockProvider = ({
  children,
  defaultSize = "sm",
}: DragDropGridMockProviderProps): JSX.Element => {
  const mockValue: DragDropGridContextValue = {
    cycleItemSize: () => {},
    getItemSize: () => defaultSize,
    getItemMinSize: () => undefined,
    getItemMaxSize: () => undefined,
    canResize: () => false,
    isEditing: false,
  };

  return (
    <DragDropGridContext.Provider value={mockValue}>
      {children}
    </DragDropGridContext.Provider>
  );
};

export default DragDropGridMockProvider;

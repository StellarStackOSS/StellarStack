"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { Layout, Layouts } from "react-grid-layout";
import { Responsive, WidthProvider } from "react-grid-layout";
import { cn } from "@stellarUI/lib/Utils";
import { BsArrowsFullscreen, BsGripVertical } from "react-icons/bs";
import type {
  DragDropGridContextValue,
  DragDropGridProps,
  GridItemConfig,
  GridItemProps,
  GridSize,
  GridSizeConfig,
  RemoveConfirmLabels,
} from "./types";
// Import react-grid-layout styles
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { TextureButton } from "@stellarUI/components/TextureButton";

export type {
  GridSize,
  GridSizeConfig,
  GridItemConfig,
  RemoveConfirmLabels,
  DragDropGridContextValue,
  DragDropGridProps,
  GridItemProps,
  Layout,
  Layouts,
};

const ResponsiveGridLayout = WidthProvider(Responsive);

// Size configurations - width (w) and height (h) in grid units
// With rowHeight=50 and gap=16: height = rowHeight * h + gap * (h - 1)
// h=2 → 116px, h=3 → 182px, h=4 → 248px, h=5 → 314px
export const gridSizeConfig: Record<GridSize, GridSizeConfig> = {
  xxs: { w: 3, h: 1.5 }, // ~116px height, 3 columns wide, compact for metric cards
  "xxs-wide": { w: 6, h: 2 }, // ~116px height, 6 columns wide, for header cards
  xs: { w: 3, h: 3 }, // ~182px height
  sm: { w: 3, h: 4 }, // ~248px height (close to 250px)
  md: { w: 6, h: 5 }, // ~314px height
  lg: { w: 6, h: 6 }, // ~380px height (2x xs height)
  xl: { w: 12, h: 6 }, // ~380px height
  xxl: { w: 12, h: 12 }, // ~644px height, full width, for console
  "xxl-wide": { w: 12, h: 2 }, // ~116px height, full width, for full-width header cards
};

const SIZE_ORDER: GridSize[] = ["xxs", "xxs-wide", "xs", "sm", "md", "lg", "xl", "xxl", "xxl-wide"];

// Breakpoints configuration
const BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
const COLS = { lg: 12, md: 12, sm: 6, xs: 4, xxs: 2 };

export const DragDropGridContext = createContext<DragDropGridContextValue | null>(null);

export const useDragDropGrid = () => {
  const context = useContext(DragDropGridContext);
  if (!context) {
    throw new Error("useDragDropGrid must be used within a DragDropGrid");
  }
  return context;
};

// Generate layout from items config
const generateLayout = (items: GridItemConfig[], cols: number = 12): Layout[] => {
  let x = 0;
  let y = 0;
  let rowHeight = 0;

  return items.map((item) => {
    const size = gridSizeConfig[item.size];
    let w = Math.min(size.w, cols); // Cap width to available cols

    // On smaller breakpoints (6 cols or less), expand small items to full width
    if (cols <= 6 && size.w <= 3) {
      w = cols;
    }

    // Check if item fits in current row
    if (x + w > cols) {
      x = 0;
      y += rowHeight;
      rowHeight = 0;
    }

    // Calculate min and max heights from allowed sizes
    let minH = gridSizeConfig.xxs.h;
    let maxH = gridSizeConfig.xxl.h;

    if (item.minSize) {
      minH = gridSizeConfig[item.minSize].h;
    }
    if (item.maxSize) {
      maxH = gridSizeConfig[item.maxSize].h;
    }

    const layout: Layout = {
      i: item.i,
      x,
      y,
      w,
      h: size.h,
      minW: 2,
      minH,
      maxH,
    };

    x += w;
    rowHeight = Math.max(rowHeight, size.h);

    return layout;
  });
};

// Generate responsive layouts
const generateResponsiveLayouts = (items: GridItemConfig[]): Layouts => {
  return {
    lg: generateLayout(items, COLS.lg),
    md: generateLayout(items, COLS.md),
    sm: generateLayout(items, COLS.sm),
    xs: generateLayout(items, COLS.xs),
    xxs: generateLayout(items, COLS.xxs),
  };
};

// Main Grid Component
const DragDropGrid = ({
  children,
  className,
  items: externalItems,
  onLayoutChange,
  onDropItem,
  onRemoveItem,
  rowHeight = 60,
  gap = 16,
  isEditing = false,
  savedLayouts,
  removeConfirmLabels,
  isDroppable = false,
  allItems: _allItems, // Destructure to prevent passing to DOM
  ...props
}: DragDropGridProps) => {
  const [items, setItems] = useState<GridItemConfig[]>(externalItems);
  const [layouts, setLayouts] = useState<Layouts>(
    () => savedLayouts || generateResponsiveLayouts(externalItems)
  );

  // Use ref to always have latest callback without causing re-renders
  const onLayoutChangeRef = useRef(onLayoutChange);
  onLayoutChangeRef.current = onLayoutChange;

  // Sync with external items/layouts when they change (e.g., reset button)
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    // Sync items and regenerate layouts when external props change
    setItems(externalItems);
    setLayouts(savedLayouts || generateResponsiveLayouts(externalItems));
  }, [externalItems, savedLayouts]);

  const getItemSize = useCallback(
    (itemId: string): GridSize => {
      return items.find((item) => item.i === itemId)?.size ?? "md";
    },
    [items]
  );

  const getItemMinSize = useCallback(
    (itemId: string): GridSize | undefined => {
      return items.find((item) => item.i === itemId)?.minSize;
    },
    [items]
  );

  const getItemMaxSize = useCallback(
    (itemId: string): GridSize | undefined => {
      return items.find((item) => item.i === itemId)?.maxSize;
    },
    [items]
  );

  const canResize = useCallback(
    (itemId: string): boolean => {
      const item = items.find((i) => i.i === itemId);
      if (!item) return true;

      const minIndex = item.minSize ? SIZE_ORDER.indexOf(item.minSize) : 0;
      const maxIndex = item.maxSize ? SIZE_ORDER.indexOf(item.maxSize) : SIZE_ORDER.length - 1;

      // Can resize if there's more than one size option
      return maxIndex > minIndex;
    },
    [items]
  );

  const getItemAllowedSizes = useCallback(
    (itemId: string): GridSize[] => {
      const item = items.find((i) => i.i === itemId);
      if (!item) return SIZE_ORDER;

      // If allowedSizes is specified, use those
      if (item.allowedSizes && item.allowedSizes.length > 0) {
        return item.allowedSizes;
      }

      // Otherwise, use min/max range
      const minIndex = item.minSize ? SIZE_ORDER.indexOf(item.minSize) : 0;
      const maxIndex = item.maxSize ? SIZE_ORDER.indexOf(item.maxSize) : SIZE_ORDER.length - 1;

      return SIZE_ORDER.slice(minIndex, maxIndex + 1);
    },
    [items]
  );

  // Track which item is being resized
  const [resizingItemId, setResizingItemId] = useState<string | null>(null);

  const cycleItemSize = useCallback((itemId: string) => {
    // Get current items from state
    setItems((prevItems) => {
      const item = prevItems.find((i) => i.i === itemId);
      if (!item) return prevItems;

      let nextSize: GridSize;

      // If allowedSizes is specified, cycle through those only
      if (item.allowedSizes && item.allowedSizes.length > 0) {
        const currentAllowedIndex = item.allowedSizes.indexOf(item.size);
        const nextAllowedIndex = (currentAllowedIndex + 1) % item.allowedSizes.length;
        nextSize = item.allowedSizes[nextAllowedIndex] as GridSize;
      } else {
        // Use min/max range
        const currentIndex = SIZE_ORDER.indexOf(item.size);
        const minIndex = item.minSize ? SIZE_ORDER.indexOf(item.minSize) : 0;
        const maxIndex = item.maxSize ? SIZE_ORDER.indexOf(item.maxSize) : SIZE_ORDER.length - 1;

        // Calculate next index within the allowed range
        let nextIndex = currentIndex + 1;

        // If we exceed maxSize, wrap back to minSize
        if (nextIndex > maxIndex) {
          nextIndex = minIndex;
        }

        nextSize = SIZE_ORDER[nextIndex] as GridSize;
      }

      const newItems = prevItems.map((i) => (i.i === itemId ? { ...i, size: nextSize } : i));

      // Update layouts
      const newLayouts = generateResponsiveLayouts(newItems);
      setLayouts(newLayouts);

      // Schedule callback outside of setState
      setTimeout(() => {
        console.log("[DragDropGrid] cycleItemSize calling onLayoutChange with:", newItems);
        onLayoutChangeRef.current?.(newItems, newLayouts);
      }, 0);

      return newItems;
    });
  }, []);

  const handleLayoutChange = useCallback(
    (currentLayout: Layout[], allLayouts: Layouts) => {
      // Snap resized items to nearest predefined size
      const snappedItems = items.map((item) => {
        const layoutItem = currentLayout.find((l) => l.i === item.i);
        if (!layoutItem || layoutItem.h === gridSizeConfig[item.size].h) {
          return item; // No change
        }

        // Find nearest predefined size height
        let nearestSize = item.size;
        let nearestDiff = Math.abs(layoutItem.h - gridSizeConfig[item.size].h);

        for (const [sizeName, sizeConfig] of Object.entries(gridSizeConfig)) {
          const diff = Math.abs(layoutItem.h - sizeConfig.h);
          if (diff < nearestDiff) {
            nearestDiff = diff;
            nearestSize = sizeName as GridSize;
          }
        }

        // Check if new size is within allowed range
        if (item.minSize || item.maxSize) {
          const minIndex = item.minSize ? SIZE_ORDER.indexOf(item.minSize) : 0;
          const maxIndex = item.maxSize ? SIZE_ORDER.indexOf(item.maxSize) : SIZE_ORDER.length - 1;
          const sizeIndex = SIZE_ORDER.indexOf(nearestSize as GridSize);

          if (sizeIndex < minIndex) {
            nearestSize = item.minSize || nearestSize;
          } else if (sizeIndex > maxIndex) {
            nearestSize = item.maxSize || nearestSize;
          }
        }

        return nearestSize !== item.size ? { ...item, size: nearestSize as GridSize } : item;
      });

      // If any items changed, regenerate layouts
      if (snappedItems.some((item, idx) => item.size !== items[idx]?.size)) {
        setItems(snappedItems);
        const newLayouts = generateResponsiveLayouts(snappedItems);
        setLayouts(newLayouts);
        setTimeout(() => {
          onLayoutChangeRef.current?.(snappedItems, newLayouts);
        }, 0);
      } else {
        setLayouts(allLayouts);
        console.log("[DragDropGrid] handleLayoutChange - saving layouts");
        setTimeout(() => {
          onLayoutChangeRef.current?.(items, allLayouts);
        }, 0);
      }
    },
    [items]
  );

  // Handle external drop
  const onDropRef = useRef(onDropItem);
  onDropRef.current = onDropItem;

  const handleDrop = useCallback((layout: Layout[], layoutItem: Layout, event: Event) => {
    const droppedItemId = (event as DragEvent).dataTransfer?.getData("text/plain");
    if (droppedItemId && onDropRef.current) {
      onDropRef.current(droppedItemId, layoutItem);
    }
  }, []);

  // Get dropping item size based on allItems config
  const droppingItem = useCallback(() => {
    // Default dropping item size
    return { i: "__dropping-elem__", w: 3, h: 3 };
  }, []);

  // Get allowed heights for an item (for snapping)
  const getAllowedHeights = useCallback(
    (itemId: string): number[] => {
      const item = items.find((i) => i.i === itemId);
      if (!item) return Object.values(gridSizeConfig).map((c) => c.h);

      let allowedSizes: GridSize[];
      if (item.allowedSizes && item.allowedSizes.length > 0) {
        allowedSizes = item.allowedSizes;
      } else {
        const minIndex = item.minSize ? SIZE_ORDER.indexOf(item.minSize) : 0;
        const maxIndex = item.maxSize ? SIZE_ORDER.indexOf(item.maxSize) : SIZE_ORDER.length - 1;
        allowedSizes = SIZE_ORDER.slice(minIndex, maxIndex + 1);
      }

      return allowedSizes.map((size) => gridSizeConfig[size].h).sort((a, b) => a - b);
    },
    [items]
  );

  // Track resize start position for step-based resizing
  const resizeStartRef = useRef<{ itemId: string; startH: number; startY: number } | null>(null);

  // Handle resize - snap to discrete allowed sizes only
  const handleResize = useCallback(
    (
      layout: Layout[],
      oldItem: Layout,
      newItem: Layout,
      placeholder: Layout,
      event: MouseEvent,
      element: HTMLElement
    ) => {
      const allowedHeights = getAllowedHeights(newItem.i);
      if (allowedHeights.length === 0) return;

      // Initialize tracking on first resize event
      if (!resizeStartRef.current || resizeStartRef.current.itemId !== newItem.i) {
        resizeStartRef.current = {
          itemId: newItem.i,
          startH: oldItem.h,
          startY: event.clientY,
        };
      }

      const currentItemIndex = allowedHeights.indexOf(oldItem.h);
      const deltaY = event.clientY - resizeStartRef.current.startY;

      // Calculate step threshold (pixels needed to move to next/prev size)
      // Use rowHeight + gap as the threshold for changing size
      const stepThreshold = rowHeight * 1.5;
      const steps = Math.round(deltaY / stepThreshold);

      // Find target height based on steps from original position
      const startIndex = allowedHeights.indexOf(resizeStartRef.current.startH);
      const targetIndex = Math.max(0, Math.min(allowedHeights.length - 1, startIndex + steps));
      const targetHeight = allowedHeights[targetIndex]!;

      // Only update if height actually changed
      if (newItem.h !== targetHeight || placeholder.h !== targetHeight) {
        newItem.h = targetHeight;
        newItem.w = oldItem.w; // Keep width stable
        placeholder.h = targetHeight;
        placeholder.w = oldItem.w;

        // Update items state to reflect new size immediately
        setItems((prevItems) => {
          const item = prevItems.find((i) => i.i === newItem.i);
          if (!item) return prevItems;

          // Find the size name for this height
          let newSize = item.size;
          for (const [sizeName, config] of Object.entries(gridSizeConfig)) {
            if (config.h === targetHeight) {
              newSize = sizeName as GridSize;
              break;
            }
          }

          if (newSize === item.size) return prevItems;

          return prevItems.map((i) => (i.i === newItem.i ? { ...i, size: newSize } : i));
        });

        // Update layouts for immediate visual feedback
        setLayouts((prev) => {
          const updated = { ...prev };
          for (const breakpoint of Object.keys(updated)) {
            const breakpointLayout = updated[breakpoint as keyof Layouts];
            if (breakpointLayout) {
              updated[breakpoint as keyof Layouts] = breakpointLayout.map((l) =>
                l.i === newItem.i ? { ...l, h: targetHeight } : l
              );
            }
          }
          return updated;
        });
      }
    },
    [getAllowedHeights, rowHeight]
  );

  // Handle resize start
  const handleResizeStart = useCallback((layout: Layout[], oldItem: Layout) => {
    setResizingItemId(oldItem.i);
    resizeStartRef.current = null; // Reset tracking
  }, []);

  // Handle resize stop
  const handleResizeStop = useCallback(
    (layout: Layout[], oldItem: Layout, newItem: Layout) => {
      setResizingItemId(null);
      resizeStartRef.current = null;

      // Ensure final state is saved
      const allowedHeights = getAllowedHeights(newItem.i);
      if (allowedHeights.length > 0 && !allowedHeights.includes(newItem.h)) {
        // Snap to nearest if somehow ended up at invalid height
        let nearestHeight = allowedHeights[0]!;
        let nearestDiff = Math.abs(newItem.h - nearestHeight);
        for (const height of allowedHeights) {
          const diff = Math.abs(newItem.h - height);
          if (diff < nearestDiff) {
            nearestDiff = diff;
            nearestHeight = height;
          }
        }
        newItem.h = nearestHeight;
      }
    },
    [getAllowedHeights]
  );

  return (
    <DragDropGridContext.Provider
      value={{
        cycleItemSize,
        getItemSize,
        getItemMinSize,
        getItemMaxSize,
        canResize,
        isEditing,
        removeConfirmLabels,
      }}
    >
      <div className={cn("drag-drop-grid w-full", className)} {...props}>
        <ResponsiveGridLayout
          className="layout"
          layouts={layouts}
          breakpoints={BREAKPOINTS}
          cols={COLS}
          rowHeight={rowHeight}
          margin={[gap, gap]}
          containerPadding={[0, 0]}
          onLayoutChange={handleLayoutChange}
          onResize={handleResize}
          onResizeStart={handleResizeStart}
          onResizeStop={handleResizeStop}
          isDraggable={isEditing}
          isResizable={isEditing}
          useCSSTransforms={true}
          isDroppable={isDroppable && isEditing}
          onDrop={handleDrop}
          droppingItem={droppingItem()}
        >
          {children}
        </ResponsiveGridLayout>
      </div>

      <style>{`
        .drag-drop-grid .react-grid-item {
          transition: all 200ms ease;
          transition-property: left, top, width, height;
        }
        .drag-drop-grid .react-grid-item.cssTransforms {
          transition-property: transform, width, height;
        }
        .drag-drop-grid.no-transition .react-grid-item,
        .drag-drop-grid.no-transition .react-grid-item.cssTransforms {
          transition: none !important;
        }
        .drag-drop-grid .react-grid-item.react-draggable-dragging {
          transition: none;
          z-index: 100;
          opacity: 0.9;
        }
        .drag-drop-grid .react-grid-item.resizing {
          transition: none;
          z-index: 100;
        }
        .drag-drop-grid .react-grid-item.dropping {
          visibility: hidden;
        }
        .drag-drop-grid .react-grid-placeholder {
          background: rgba(113, 113, 122, 0.5);
          border: 1px solid rgba(161, 161, 170, 0.3);
          border-radius: 12px;
          transition-duration: 100ms;
          z-index: 2;
        }
        .drag-drop-grid .react-grid-item.react-grid-placeholder {
          background: rgba(113, 113, 122, 0.15);
          border: 1px solid rgba(161, 161, 170, 0.3);
        }
        /* Touch support styles */
        .drag-drop-grid .drag-handle {
          touch-action: none;
          -webkit-touch-callout: none;
          -webkit-user-select: none;
          user-select: none;
        }
        .drag-drop-grid .react-grid-item {
          touch-action: auto;
        }
        .drag-drop-grid .react-grid-item.react-draggable-dragging {
          touch-action: none;
        }
        /* Prevent text selection during drag on touch */
        @media (pointer: coarse) {
          .drag-drop-grid .react-grid-item {
            -webkit-touch-callout: none;
            -webkit-user-select: none;
            user-select: none;
          }
        }
      `}</style>
    </DragDropGridContext.Provider>
  );
};

// Grid Item Component
const GridItem = ({
  itemId,
  children,
  className,
  showRemoveHandle = true,
  showDragHandle = true,
  ...props
}: GridItemProps) => {
  const { isEditing } = useDragDropGrid();

  return (
    <div
      key={itemId}
      data-item-id={itemId}
      className={cn(
        "group relative flex h-full w-full flex-col",
        isEditing &&
          "cursor-move hover:rounded-xl hover:outline hover:outline-2 hover:outline-zinc-500/50",
        className
      )}
      {...props}
    >
      {/* Content wrapper */}
      <div className="relative h-full w-full flex-1 overflow-hidden">{children}</div>
    </div>
  );
};

export { GridItem };
export default DragDropGrid;

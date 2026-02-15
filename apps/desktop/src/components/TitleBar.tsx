import { getCurrentWindow } from "@tauri-apps/api/window";
import { ReactNode } from "react";

const IS_MAC = navigator.platform.startsWith("Mac");

/** Traffic light button width + spacing on macOS */
const TRAFFIC_LIGHT_WIDTH = 78;

interface TitleBarProps {
  /** Optional content to display in the titlebar (macOS: after traffic lights) */
  children?: ReactNode;
}

/**
 * Custom window title bar with platform-native controls.
 * On macOS, native traffic lights are shown and custom content can be placed after them.
 * On Windows/Linux, custom window controls are rendered on the right.
 */
const TitleBar = ({ children }: TitleBarProps): JSX.Element => {
  const HandleMinimize = (): void => {
    getCurrentWindow().minimize();
  };

  const HandleMaximize = (): void => {
    getCurrentWindow().toggleMaximize();
  };

  const HandleClose = (): void => {
    getCurrentWindow().close();
  };

  if (IS_MAC) {
    // macOS: Native traffic lights are positioned by the OS.
    // We create a titlebar region with padding for the traffic lights,
    // and allow custom content to be placed after them.
    return (
      <div className="fixed top-0 right-0 left-0 z-[9999] flex h-11 items-center select-none">
        {/* Space for native traffic lights */}
        <div
          data-tauri-drag-region
          className="h-full flex-shrink-0"
          style={{ width: TRAFFIC_LIGHT_WIDTH }}
        />

        {/* Custom content area */}
        {children && <div className="flex h-full min-w-0 flex-1 items-center">{children}</div>}

        {/* Draggable region fills remaining space */}
        <div data-tauri-drag-region className="h-full flex-1" />
      </div>
    );
  }

  // Windows / Linux: Custom window controls on the right
  return (
    <div className="fixed top-0 right-0 left-0 z-[9999] flex h-8 items-center justify-between bg-black/50 select-none">
      <div data-tauri-drag-region className="flex h-full flex-1 items-center pl-3">
        {children || (
          <span data-tauri-drag-region className="text-xs font-medium tracking-wide text-white/50">
            StellarStack
          </span>
        )}
      </div>

      {/* Window controls */}
      <div className="flex h-full">
        <button
          onClick={HandleMinimize}
          title="Minimize"
          className="flex h-8 w-[46px] cursor-pointer items-center justify-center border-none bg-transparent text-white/60 transition-all duration-150 hover:bg-white/10 hover:text-white"
        >
          <svg width="10" height="1" viewBox="0 0 10 1" fill="none">
            <line x1="0" y1="0.5" x2="10" y2="0.5" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>

        <button
          onClick={HandleMaximize}
          title="Maximize"
          className="flex h-8 w-[46px] cursor-pointer items-center justify-center border-none bg-transparent text-white/60 transition-all duration-150 hover:bg-white/10 hover:text-white"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <rect
              x="0.5"
              y="0.5"
              width="9"
              height="9"
              stroke="currentColor"
              strokeWidth="1"
              fill="none"
            />
          </svg>
        </button>

        <button
          onClick={HandleClose}
          title="Close"
          className="flex h-8 w-[46px] cursor-pointer items-center justify-center border-none bg-transparent text-white/60 transition-all duration-150 hover:bg-[#e81123] hover:text-white"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" strokeWidth="1.2" />
            <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default TitleBar;

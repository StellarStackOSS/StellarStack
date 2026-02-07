import { getCurrentWindow } from "@tauri-apps/api/window";

const IS_MAC = navigator.platform.startsWith("Mac");

/**
 * Custom window title bar with platform-native controls.
 * Renders macOS traffic lights on the left or Windows controls on the right.
 */
const TitleBar = (): JSX.Element => {
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
    return (
      <div className="fixed top-0 left-0 right-0 h-8 z-[9999] flex items-center select-none">
        {/* macOS traffic lights */}
        <div className="group flex items-center gap-2 pl-3 h-full">
          <button
            onClick={HandleClose}
            title="Close"
            className="w-3 h-3 rounded-full bg-[#ff5f57] border-none cursor-pointer flex items-center justify-center p-0 hover:brightness-110"
          >
            <svg width="6" height="6" viewBox="0 0 6 6" className="opacity-0 group-hover:opacity-100">
              <line x1="0.5" y1="0.5" x2="5.5" y2="5.5" stroke="rgba(0,0,0,0.6)" strokeWidth="1.2" />
              <line x1="5.5" y1="0.5" x2="0.5" y2="5.5" stroke="rgba(0,0,0,0.6)" strokeWidth="1.2" />
            </svg>
          </button>
          <button
            onClick={HandleMinimize}
            title="Minimize"
            className="w-3 h-3 rounded-full bg-[#febc2e] border-none cursor-pointer flex items-center justify-center p-0 hover:brightness-110"
          >
            <svg width="6" height="1" viewBox="0 0 6 1" className="opacity-0 group-hover:opacity-100">
              <line x1="0.5" y1="0.5" x2="5.5" y2="0.5" stroke="rgba(0,0,0,0.6)" strokeWidth="1.2" />
            </svg>
          </button>
          <button
            onClick={HandleMaximize}
            title="Maximize"
            className="w-3 h-3 rounded-full bg-[#28c840] border-none cursor-pointer flex items-center justify-center p-0 hover:brightness-110"
          >
            <svg width="6" height="6" viewBox="0 0 6 6" className="opacity-0 group-hover:opacity-100">
              <polyline points="1,3.5 1,1 3.5,1" fill="none" stroke="rgba(0,0,0,0.6)" strokeWidth="1.2" />
              <polyline points="5,2.5 5,5 2.5,5" fill="none" stroke="rgba(0,0,0,0.6)" strokeWidth="1.2" />
            </svg>
          </button>
        </div>

        {/* Draggable region fills the rest */}
        <div data-tauri-drag-region className="flex-1 h-full" />
      </div>
    );
  }

  return (
    <div className="fixed top-0 left-0 right-0 h-8 z-[9999] flex items-center justify-between select-none">
      <div data-tauri-drag-region className="flex-1 h-full flex items-center pl-3">
        <span data-tauri-drag-region className="text-xs font-medium text-white/50 tracking-wide">
          StellarStack
        </span>
      </div>

      {/* Windows / Linux controls */}
      <div className="flex h-full">
        <button
          onClick={HandleMinimize}
          title="Minimize"
          className="w-[46px] h-8 flex items-center justify-center bg-transparent border-none cursor-pointer text-white/60 transition-all duration-150 hover:bg-white/8 hover:text-white"
        >
          <svg width="10" height="1" viewBox="0 0 10 1" fill="none">
            <line x1="0" y1="0.5" x2="10" y2="0.5" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>

        <button
          onClick={HandleMaximize}
          title="Maximize"
          className="w-[46px] h-8 flex items-center justify-center bg-transparent border-none cursor-pointer text-white/60 transition-all duration-150 hover:bg-white/8 hover:text-white"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" strokeWidth="1" fill="none" />
          </svg>
        </button>

        <button
          onClick={HandleClose}
          title="Close"
          className="w-[46px] h-8 flex items-center justify-center bg-transparent border-none cursor-pointer text-white/60 transition-all duration-150 hover:bg-[#e81123] hover:text-white"
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

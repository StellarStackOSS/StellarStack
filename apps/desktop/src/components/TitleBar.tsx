import { getCurrentWindow } from "@tauri-apps/api/window";

/**
 * Custom Discord-style window title bar with drag region and controls.
 */
const TitleBar = (): JSX.Element => {
  const handleMinimize = (): void => {
    getCurrentWindow().minimize();
  };

  const handleMaximize = (): void => {
    getCurrentWindow().toggleMaximize();
  };

  const handleClose = (): void => {
    getCurrentWindow().close();
  };

  return (
    <div className="fixed top-0 left-0 right-0 h-8 z-[9999] flex items-center justify-between select-none">
      <div data-tauri-drag-region className="flex-1 h-full flex items-center pl-3">
        <span data-tauri-drag-region className="text-xs font-medium text-white/50 tracking-wide">
          StellarStack
        </span>
      </div>

      <div className="flex h-full">
        <button
          onClick={handleMinimize}
          title="Minimize"
          className="w-[46px] h-8 flex items-center justify-center bg-transparent border-none cursor-pointer text-white/60 transition-all duration-150 hover:bg-white/8 hover:text-white"
        >
          <svg width="10" height="1" viewBox="0 0 10 1" fill="none">
            <line x1="0" y1="0.5" x2="10" y2="0.5" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>

        <button
          onClick={handleMaximize}
          title="Maximize"
          className="w-[46px] h-8 flex items-center justify-center bg-transparent border-none cursor-pointer text-white/60 transition-all duration-150 hover:bg-white/8 hover:text-white"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" strokeWidth="1" fill="none" />
          </svg>
        </button>

        <button
          onClick={handleClose}
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

/** Tauri v2 global type declarations for desktop mode. */
interface Window {
  __TAURI__?: {
    core: {
      invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
    };
    event: {
      listen: (event: string, handler: (e: { payload: unknown }) => void) => Promise<() => void>;
    };
    window: {
      getCurrentWindow: () => {
        minimize: () => Promise<void>;
        toggleMaximize: () => Promise<void>;
        close: () => Promise<void>;
        isMaximized: () => Promise<boolean>;
        hide: () => Promise<void>;
        show: () => Promise<void>;
      };
    };
  };
}

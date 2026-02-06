/** Tauri v2 global type declarations for desktop mode. */
interface Window {
  __TAURI__: {
    core: {
      invoke: <T = unknown>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
    };
    event: {
      listen: (event: string, handler: (e: { payload: string }) => void) => Promise<() => void>;
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

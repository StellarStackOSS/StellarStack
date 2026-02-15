"use client";

import React, { useState, useEffect } from "react";

/**
 * Custom window title bar for the Tauri desktop app.
 * Detects platform at runtime and renders macOS traffic lights on the left
 * or Windows/Linux controls on the right.
 * Only rendered when NEXT_PUBLIC_DESKTOP_MODE is "true".
 */
const TitleBar = (): React.JSX.Element => {
  const [isMac, setIsMac] = useState<boolean>(false);

  useEffect(() => {
    const mac = navigator.platform.startsWith("Mac");
    setIsMac(mac);

    // Tag root element for platform-specific CSS
    // Sidebar offset is handled via CSS in globals.css
    document.documentElement.classList.add("desktop-mode");
    if (mac) {
      document.documentElement.classList.add("macos");
    }

    return () => {
      document.documentElement.classList.remove("desktop-mode", "macos");
    };
  }, []);

  const HandleMinimize = (): void => {
    window.__TAURI__?.window?.getCurrentWindow()?.minimize();
  };

  const HandleMaximize = (): void => {
    window.__TAURI__?.window?.getCurrentWindow()?.toggleMaximize();
  };

  const HandleClose = (): void => {
    window.__TAURI__?.window?.getCurrentWindow()?.close();
  };

  if (isMac) {
    // On macOS with native decorations enabled, the OS renders the traffic lights.
    // We just provide a draggable titlebar region.
    return (
      <div style={barStyleMac}>
        <div data-tauri-drag-region style={{ flex: 1, height: "100%" }} />
      </div>
    );
  }

  return (
    <div style={barStyle}>
      {/* Draggable area */}
      <div data-tauri-drag-region style={{ flex: 1, height: "100%" }} />

      {/* Windows / Linux controls */}
      <div style={{ display: "flex", height: "100%" }}>
        <button
          onClick={HandleMinimize}
          title="Minimize"
          style={winBtnStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.08)";
            e.currentTarget.style.color = "#fff";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "rgba(255,255,255,0.6)";
          }}
        >
          <svg width="10" height="1" viewBox="0 0 10 1" fill="none">
            <line x1="0" y1="0.5" x2="10" y2="0.5" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>

        <button
          onClick={HandleMaximize}
          title="Maximize"
          style={winBtnStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.08)";
            e.currentTarget.style.color = "#fff";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "rgba(255,255,255,0.6)";
          }}
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
          style={winBtnStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#e81123";
            e.currentTarget.style.color = "#fff";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "rgba(255,255,255,0.6)";
          }}
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

/** Shared bar container style */
const barStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  height: 32,
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  userSelect: "none",
  WebkitUserSelect: "none",
};

/** macOS bar style - taller to match native titlebar */
const barStyleMac: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  height: 44,
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  userSelect: "none",
  WebkitUserSelect: "none",
};

/** Windows / Linux button style */
const winBtnStyle: React.CSSProperties = {
  width: 46,
  height: 32,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  color: "rgba(255,255,255,0.6)",
  transition: "background 0.15s, color 0.15s",
};

export default TitleBar;

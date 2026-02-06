"use client";

import React from "react";

/**
 * Custom window title bar for the Tauri desktop app.
 * Renders a Discord-style title bar with drag region and window controls.
 * Only rendered when NEXT_PUBLIC_DESKTOP_MODE is "true".
 */
const TitleBar = (): React.JSX.Element => {
  const handleMinimize = (): void => {
    window.__TAURI__?.window?.getCurrentWindow()?.minimize();
  };

  const handleMaximize = (): void => {
    window.__TAURI__?.window?.getCurrentWindow()?.toggleMaximize();
  };

  const handleClose = (): void => {
    window.__TAURI__?.window?.getCurrentWindow()?.close();
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 32,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      {/* Draggable area — transparent, sits above app header */}
      <div
        data-tauri-drag-region
        style={{
          flex: 1,
          height: "100%",
        }}
      />

      {/* Window controls */}
      <div style={{ display: "flex", height: "100%" }}>
        <button
          onClick={handleMinimize}
          title="Minimize"
          style={btnStyle}
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
          onClick={handleMaximize}
          title="Maximize"
          style={btnStyle}
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
            <rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" strokeWidth="1" fill="none" />
          </svg>
        </button>

        <button
          onClick={handleClose}
          title="Close"
          style={btnStyle}
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

const btnStyle: React.CSSProperties = {
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

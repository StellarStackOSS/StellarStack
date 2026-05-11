import { useEffect } from "react"

type DesktopBridge = { desktop?: boolean; platform?: NodeJS.Platform }

const bridge: DesktopBridge | undefined =
  typeof window !== "undefined"
    ? (window as unknown as { stellar?: DesktopBridge }).stellar
    : undefined

const TITLEBAR_HEIGHT = 36

export const DesktopTitleBar = () => {
  useEffect(() => {
    if (bridge?.desktop !== true) return
    document.documentElement.dataset.desktop = "true"
    document.documentElement.style.setProperty(
      "--desktop-titlebar-h",
      `${String(TITLEBAR_HEIGHT)}px`
    )
    return () => {
      delete document.documentElement.dataset.desktop
      document.documentElement.style.removeProperty("--desktop-titlebar-h")
    }
  }, [])

  if (bridge?.desktop !== true) return null
  return (
    <div
      style={
        {
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: TITLEBAR_HEIGHT,
          zIndex: 9999,
          WebkitAppRegion: "drag",
          pointerEvents: "none",
          background: "transparent",
        } as React.CSSProperties
      }
    />
  )
}

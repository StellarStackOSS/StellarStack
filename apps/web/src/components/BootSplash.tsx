import { useEffect, useState } from "react"

const STORAGE_KEY = "stellar.boot.splash.seen"

type DesktopBridge = { desktop?: boolean }
const bridge: DesktopBridge | undefined =
  typeof window !== "undefined"
    ? (window as unknown as { stellar?: DesktopBridge }).stellar
    : undefined

export const BootSplash = () => {
  const [show, setShow] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    if (bridge?.desktop !== true) return false
    return window.sessionStorage.getItem(STORAGE_KEY) !== "1"
  })
  const [fading, setFading] = useState(false)

  useEffect(() => {
    if (!show) return
    const fadeAt = window.setTimeout(() => {
      setFading(true)
    }, 1600)
    const hideAt = window.setTimeout(() => {
      window.sessionStorage.setItem(STORAGE_KEY, "1")
      setShow(false)
    }, 2200)
    return () => {
      window.clearTimeout(fadeAt)
      window.clearTimeout(hideAt)
    }
  }, [show])

  if (!show) return null
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "var(--background, #130f0c)",
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
        opacity: fading ? 0 : 1,
        transition: "opacity 560ms cubic-bezier(0.4, 0, 0.2, 1)",
        pointerEvents: fading ? "none" : "auto",
      }}
    >
      <div
        aria-hidden
        className="select-none text-center font-semibold tracking-tighter text-white/[0.04]"
        style={{
          fontSize: "clamp(40px, 16vw, 240px)",
          lineHeight: 0.85,
          animation: "bootSplashRise 1400ms cubic-bezier(0.22, 1, 0.36, 1) both",
        }}
      >
        StellarStack
      </div>
      <style>{`
        @keyframes bootSplashRise {
          from { opacity: 0; transform: translateY(24px) scale(0.985); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tiny shim around the Cloudflare Turnstile JS API. The widget script is
// loaded async from index.html, which means `window.turnstile` may not
// exist at the moment a component mounts. `waitForTurnstile` polls until
// it's there, then resolves.
// ---------------------------------------------------------------------------

type RenderOptions = {
  sitekey: string
  size?: "normal" | "compact" | "invisible"
  appearance?: "always" | "execute" | "interaction-only"
  callback?: (token: string) => void
  "error-callback"?: () => void
  "expired-callback"?: () => void
}

type Turnstile = {
  render: (container: HTMLElement, options: RenderOptions) => string
  execute: (widgetId: string) => void
  reset: (widgetId: string) => void
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: Turnstile
  }
}

export const waitForTurnstile = async (timeoutMs = 5_000): Promise<Turnstile> => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (window.turnstile !== undefined) return window.turnstile
    await new Promise((r) => setTimeout(r, 50))
  }
  throw new Error("turnstile-script-not-loaded")
}

export type { Turnstile }

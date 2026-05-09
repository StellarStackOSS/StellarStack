import { type RefObject, useEffect, useRef, useState } from "react"

import { waitForTurnstile } from "@/lib/Turnstile"

const MARKETING_URL = import.meta.env["VITE_MARKETING_URL"] as string | undefined
const TURNSTILE_SITE_KEY = import.meta.env["VITE_TURNSTILE_SITE_KEY"] as
  | string
  | undefined

export type WaitlistStatus = "idle" | "submitting" | "ok" | "error"

export type UseWaitlist = {
  status: WaitlistStatus
  errorMessage: string | null
  /** Honeypot value — render it inside an off-screen input. */
  honeypot: string
  setHoneypot: (next: string) => void
  /** Anchor for Cloudflare's invisible widget iframe. */
  turnstileContainerRef: RefObject<HTMLDivElement | null>
  /** Submit the email. Returns nothing — read `status` to react. */
  submit: (email: string, source?: string) => Promise<void>
}

const apiErrorMessage = (code: string): string => {
  switch (code) {
    case "rate_limited":
      return "Too many tries. Wait a moment and try again."
    case "captcha_failed":
      return "Captcha failed. Refresh and try again."
    case "disposable_email":
      return "Please use a non-disposable email."
    case "invalid_body":
      return "That email doesn't look right."
    case "email_failed":
      return "Couldn't send the confirmation email. Try again."
    default:
      return "Something went wrong. Try again."
  }
}

/**
 * Drives the waitlist form: renders an invisible Cloudflare Turnstile
 * widget on mount, exposes a `submit(email)` that mints a fresh token and
 * POSTs to the marketing service. The caller owns the email input + the
 * submit button; this hook just owns the submission lifecycle so the
 * Hero's shared-layoutId button can stay in `App.tsx` unchanged.
 */
export const useWaitlist = (): UseWaitlist => {
  const [status, setStatus] = useState<WaitlistStatus>("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [honeypot, setHoneypot] = useState("")

  const widgetIdRef = useRef<string | null>(null)
  const tokenResolverRef = useRef<((token: string) => void) | null>(null)
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (TURNSTILE_SITE_KEY === undefined || TURNSTILE_SITE_KEY === "") return
    let cancelled = false
    let widgetId: string | null = null

    void (async () => {
      try {
        const turnstile = await waitForTurnstile()
        if (cancelled || turnstileContainerRef.current === null) return
        widgetId = turnstile.render(turnstileContainerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          size: "invisible",
          callback: (token) => {
            tokenResolverRef.current?.(token)
            tokenResolverRef.current = null
          },
          "error-callback": () => {
            tokenResolverRef.current?.("")
            tokenResolverRef.current = null
          },
          "expired-callback": () => {
            tokenResolverRef.current?.("")
            tokenResolverRef.current = null
          },
        })
        widgetIdRef.current = widgetId
      } catch {
        // Script never loaded; submit() will report the failure.
      }
    })()

    return () => {
      cancelled = true
      if (widgetId !== null && window.turnstile !== undefined) {
        window.turnstile.remove(widgetId)
      }
      widgetIdRef.current = null
    }
  }, [])

  const getTurnstileToken = async (): Promise<string> => {
    if (TURNSTILE_SITE_KEY === undefined || TURNSTILE_SITE_KEY === "") {
      // No site key configured — let dev runs through with an empty token.
      return ""
    }
    const widgetId = widgetIdRef.current
    if (widgetId === null) throw new Error("captcha-not-ready")
    const turnstile = await waitForTurnstile()
    return new Promise<string>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        tokenResolverRef.current = null
        reject(new Error("captcha-timeout"))
      }, 15_000)
      tokenResolverRef.current = (t) => {
        window.clearTimeout(timer)
        resolve(t)
      }
      turnstile.execute(widgetId)
    })
  }

  const submit = async (email: string, source = "hero") => {
    if (status === "submitting") return
    if (MARKETING_URL === undefined || MARKETING_URL === "") {
      setStatus("error")
      setErrorMessage("Waitlist isn't wired up yet.")
      return
    }
    setStatus("submitting")
    setErrorMessage(null)
    try {
      const token = await getTurnstileToken()
      const res = await fetch(`${MARKETING_URL}/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          turnstileToken: token,
          source,
          website: honeypot,
        }),
      })
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
      }
      if (!res.ok || body.ok !== true) {
        setStatus("error")
        setErrorMessage(apiErrorMessage(body.error ?? "unknown"))
        const wid = widgetIdRef.current
        if (wid !== null && window.turnstile !== undefined) {
          window.turnstile.reset(wid)
        }
        return
      }
      setStatus("ok")
    } catch {
      setStatus("error")
      setErrorMessage("Network error. Try again.")
    }
  }

  return {
    status,
    errorMessage,
    honeypot,
    setHoneypot,
    turnstileContainerRef,
    submit,
  }
}

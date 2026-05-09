import { useState } from "react"

const MARKETING_URL = import.meta.env["VITE_MARKETING_URL"] as string | undefined

const STORAGE_KEY = "stellar.waitlist.email"

export type WaitlistStatus = "idle" | "submitting" | "ok" | "error"

export type UseWaitlist = {
  status: WaitlistStatus
  errorMessage: string | null
  /** Email previously submitted on this device, if any. The Hero swaps
   *  to the success view on mount when this is set. */
  submittedEmail: string | null
  /** Honeypot value — render it inside an off-screen input. */
  honeypot: string
  setHoneypot: (next: string) => void
  /** Submit the email. Returns nothing — read `status` to react. */
  submit: (email: string, source?: string) => Promise<void>
  /** Wipe the local "already submitted" memory so the form re-appears.
   *  Useful as an escape hatch if the user wants to use a different
   *  email. */
  reset: () => void
}

const apiErrorMessage = (code: string): string => {
  switch (code) {
    case "rate_limited":
      return "Too many tries. Wait a moment and try again."
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

// Defensive read — `localStorage` throws if storage is disabled (Safari
// private mode, some embedded browsers). We treat any failure as "no
// prior submission" rather than crashing the page.
const readSubmittedEmail = (): string | null => {
  if (typeof window === "undefined") return null
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return value !== null && value !== "" ? value : null
  } catch {
    return null
  }
}

const writeSubmittedEmail = (email: string): void => {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, email)
  } catch {
    /* swallow — the form still works without the persistence */
  }
}

const clearSubmittedEmail = (): void => {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* swallow */
  }
}

/**
 * Drives the waitlist form: POSTs to the marketing service, exposes a
 * status state machine + a honeypot field. The caller owns the email
 * input + submit button; the hook just owns the submission lifecycle so
 * the Hero's shared-layoutId button stays untouched in `App.tsx`.
 *
 * On mount we hydrate the submitted email from `localStorage` so a
 * returning user sees "you're on the list" without retyping. The flag
 * is purely local — clearing it via the `reset()` callback or in
 * devtools doesn't undo the actual signup on the server.
 */
export const useWaitlist = (): UseWaitlist => {
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(() =>
    readSubmittedEmail()
  )
  const [status, setStatus] = useState<WaitlistStatus>(() =>
    readSubmittedEmail() !== null ? "ok" : "idle"
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [honeypot, setHoneypot] = useState("")

  const submit = async (email: string, source = "hero") => {
    if (status === "submitting") return
    if (MARKETING_URL === undefined || MARKETING_URL === "") {
      setStatus("error")
      setErrorMessage("Waitlist isn't wired up yet.")
      return
    }
    const trimmed = email.trim()
    setStatus("submitting")
    setErrorMessage(null)
    try {
      const res = await fetch(`${MARKETING_URL}/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmed,
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
        return
      }
      writeSubmittedEmail(trimmed)
      setSubmittedEmail(trimmed)
      setStatus("ok")
    } catch {
      setStatus("error")
      setErrorMessage("Network error. Try again.")
    }
  }

  const reset = () => {
    clearSubmittedEmail()
    setSubmittedEmail(null)
    setStatus("idle")
    setErrorMessage(null)
  }

  return {
    status,
    errorMessage,
    submittedEmail,
    honeypot,
    setHoneypot,
    submit,
    reset,
  }
}

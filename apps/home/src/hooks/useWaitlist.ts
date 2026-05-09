import { useState } from "react"

const MARKETING_URL = import.meta.env["VITE_MARKETING_URL"] as string | undefined

export type WaitlistStatus = "idle" | "submitting" | "ok" | "error"

export type UseWaitlist = {
  status: WaitlistStatus
  errorMessage: string | null
  /** Honeypot value — render it inside an off-screen input. */
  honeypot: string
  setHoneypot: (next: string) => void
  /** Submit the email. Returns nothing — read `status` to react. */
  submit: (email: string, source?: string) => Promise<void>
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

/**
 * Drives the waitlist form: POSTs to the marketing service, exposes a
 * status state machine + a honeypot field. The caller owns the email
 * input + submit button; the hook just owns the submission lifecycle so
 * the Hero's shared-layoutId button stays untouched in `App.tsx`.
 */
export const useWaitlist = (): UseWaitlist => {
  const [status, setStatus] = useState<WaitlistStatus>("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [honeypot, setHoneypot] = useState("")

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
      const res = await fetch(`${MARKETING_URL}/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
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
    submit,
  }
}

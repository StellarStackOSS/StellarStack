import { useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import { Button } from "@workspace/ui/components/button"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@workspace/ui/components/input-otp"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { parseApiErrorBody } from "@workspace/shared/errors"

import { authClient } from "@/lib/AuthClient"
import { translateApiError } from "@/lib/TranslateError"

type Step = "email" | "totp"

const AppleGlyph = () => (
  <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
    <path d="M16.365 1.43c0 1.14-.412 2.117-1.236 2.93-.823.815-1.834 1.298-2.785 1.232-.114-1.087.347-2.099 1.21-2.93.864-.83 1.985-1.293 2.81-1.232ZM21.04 17.345c-.557 1.27-.823 1.84-1.54 2.962-.999 1.564-2.408 3.51-4.156 3.526-1.553.014-1.953-1.012-4.063-1.001-2.11.011-2.55 1.018-4.106 1.005-1.748-.016-3.082-1.776-4.082-3.341C-.04 16.94-.336 11.682 1.41 8.86c1.235-2.005 3.184-3.18 5.012-3.18 1.857 0 3.025 1.026 4.563 1.026 1.493 0 2.402-1.029 4.55-1.029 1.62 0 3.339.882 4.566 2.408-4.012 2.198-3.36 7.94.94 9.26Z" />
  </svg>
)

const GoogleGlyph = () => (
  <svg viewBox="0 0 24 24" className="size-4">
    <path
      fill="#EA4335"
      d="M12 5.04c1.79 0 3.4.61 4.66 1.81l3.49-3.49C18.07 1.55 15.27.5 12 .5 7.32.5 3.27 3.18 1.27 7.06l4.07 3.16C6.28 7.32 8.92 5.04 12 5.04Z"
    />
    <path
      fill="#34A853"
      d="M23.5 12.27c0-.84-.07-1.64-.21-2.41H12v4.56h6.46c-.28 1.5-1.13 2.77-2.4 3.62l3.95 3.06c2.31-2.13 3.49-5.27 3.49-8.83Z"
    />
    <path
      fill="#FBBC05"
      d="M5.34 14.22a7.04 7.04 0 0 1 0-4.44L1.27 6.62A11.5 11.5 0 0 0 .5 12c0 1.93.46 3.74 1.27 5.38l4.07-3.16Z"
    />
    <path
      fill="#4285F4"
      d="M12 23.5c3.27 0 6.02-1.07 8.02-2.92l-3.95-3.06c-1.1.74-2.5 1.18-4.07 1.18-3.08 0-5.72-2.28-6.66-5.18l-4.07 3.16C3.27 20.82 7.32 23.5 12 23.5Z"
    />
  </svg>
)

const DiscordGlyph = () => (
  <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
    <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.058a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03ZM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.418 2.157-2.418 1.21 0 2.176 1.094 2.157 2.418 0 1.334-.956 2.42-2.157 2.42Zm7.974 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.418 2.157-2.418 1.21 0 2.176 1.094 2.157 2.418 0 1.334-.946 2.42-2.157 2.42Z" />
  </svg>
)

export const LoginPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>("email")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [useBackup, setUseBackup] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const goDashboard = () => navigate({ to: "/dashboard" })

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setPending(true)
    const result = await authClient.signIn.email({ email, password })
    setPending(false)
    if (result.error !== null && result.error !== undefined) {
      const parsed = parseApiErrorBody(JSON.stringify({ error: result.error }))
      setErrorMessage(
        parsed !== null
          ? translateApiError(t, parsed.error)
          : (result.error.message ?? t("internal.unexpected", { ns: "errors" }))
      )
      return
    }
    const data = result.data as { twoFactorRedirect?: boolean } | null
    if (data?.twoFactorRedirect === true) {
      setStep("totp")
      return
    }
    await goDashboard()
  }

  const handleTotpSubmit = async (override?: string) => {
    setErrorMessage(null)
    setPending(true)
    const value = override ?? code
    const result = useBackup
      ? await authClient.twoFactor.verifyBackupCode({ code: value })
      : await authClient.twoFactor.verifyTotp({ code: value })
    setPending(false)
    if (result.error !== null && result.error !== undefined) {
      setErrorMessage(result.error.message ?? "Invalid code")
      return
    }
    await goDashboard()
  }

  const handlePasskeySignIn = async () => {
    setErrorMessage(null)
    setPending(true)
    try {
      const result = await authClient.signIn.passkey()
      if (result?.error) {
        setErrorMessage(result.error.message ?? "Passkey sign-in failed")
        return
      }
      await goDashboard()
    } catch {
      setErrorMessage("Passkey sign-in was cancelled or failed.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6">
      {/* Brand row */}
      <div className="flex items-center gap-2">
        <img src="/logo.png" alt="" className="size-6 shrink-0" />
        <span className="text-sm font-medium text-foreground">StellarStack</span>
      </div>

      {/* Card */}
      <div className="w-full max-w-md">
        {step === "email" ? (
          <div className="border-border bg-card rounded-xl border p-6 shadow-sm">
            <div className="text-center">
              <h1 className="text-xl font-semibold text-foreground">Welcome back</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Login with your Apple, Google, or Discord account
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
              >
                <AppleGlyph />
                Login with Apple
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
              >
                <GoogleGlyph />
                Login with Google
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
              >
                <DiscordGlyph />
                Login with Discord
              </Button>
            </div>

            <div className="my-6 flex items-center gap-3">
              <div className="border-border h-px flex-1 border-t" />
              <span className="text-muted-foreground text-xs">Or continue with</span>
              <div className="border-border h-px flex-1 border-t" />
            </div>

            <form className="flex flex-col gap-3" onSubmit={handleEmailSubmit}>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Email</Label>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="m@example.com"
                  autoComplete="email webauthn"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Password</Label>
                  <button
                    type="button"
                    className="text-muted-foreground text-xs hover:text-foreground"
                    onClick={() => {
                      /* hook up forgot-password later */
                    }}
                  >
                    Forgot your password?
                  </button>
                </div>
                <Input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password webauthn"
                />
              </div>

              {errorMessage !== null ? (
                <p className="text-destructive text-xs" role="alert">
                  {errorMessage}
                </p>
              ) : null}

              <Button
                type="submit"
                disabled={pending}
                className="mt-2 w-full bg-white text-zinc-900 hover:bg-zinc-200"
              >
                {pending ? t("auth.login.submitting") : "Login"}
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => void handlePasskeySignIn()}
                className="text-muted-foreground hover:text-foreground"
              >
                Sign in with a passkey
              </Button>
            </form>

            <p className="text-muted-foreground mt-4 text-center text-xs">
              Don&apos;t have an account?{" "}
              <Link to="/register" className="text-foreground underline">
                Sign up
              </Link>
            </p>
          </div>
        ) : (
          <div className="border-border bg-card rounded-xl border p-6 shadow-sm">
            <div className="text-center">
              <h1 className="text-xl font-semibold text-foreground">
                Two-factor authentication
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                {useBackup
                  ? "Enter one of your backup codes."
                  : "Enter the 6-digit code from your authenticator app."}
              </p>
            </div>

            <form
              className="mt-6 flex flex-col gap-3"
              onSubmit={(e) => { e.preventDefault(); void handleTotpSubmit() }}
            >
              {useBackup ? (
                <Input
                  autoFocus
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  maxLength={32}
                  inputMode="text"
                  autoComplete="one-time-code"
                  className="text-center font-mono"
                />
              ) : (
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={code}
                    onChange={(v) => {
                      setCode(v)
                      if (v.length === 6) void handleTotpSubmit(v)
                    }}
                    autoFocus
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              )}

              {errorMessage !== null ? (
                <p className="text-destructive text-xs text-center" role="alert">
                  {errorMessage}
                </p>
              ) : null}

              <Button
                type="submit"
                disabled={pending || code === ""}
                className="mt-2 w-full bg-white text-zinc-900 hover:bg-zinc-200"
              >
                {pending ? "Verifying…" : "Verify"}
              </Button>

              <button
                type="button"
                className="text-muted-foreground hover:text-foreground text-xs"
                onClick={() => {
                  setUseBackup(!useBackup)
                  setCode("")
                  setErrorMessage(null)
                }}
              >
                {useBackup
                  ? "Use authenticator code instead"
                  : "Use a backup code instead"}
              </button>

              <button
                type="button"
                className="text-muted-foreground hover:text-foreground text-xs"
                onClick={() => {
                  setStep("email")
                  setCode("")
                  setErrorMessage(null)
                }}
              >
                Back to sign in
              </button>
            </form>
          </div>
        )}
      </div>

      <p className="text-muted-foreground max-w-md text-center text-xs">
        By clicking continue, you agree to our{" "}
        <a href="/terms" className="text-foreground underline">
          Terms of Service
        </a>{" "}
        and{" "}
        <a href="/privacy" className="text-foreground underline">
          Privacy Policy
        </a>
        .
      </p>
    </div>
  )
}

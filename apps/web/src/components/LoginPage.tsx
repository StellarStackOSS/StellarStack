import { useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { parseApiErrorBody } from "@workspace/shared/errors"

import { AuthCard } from "@/components/AuthCard"
import { authClient } from "@/lib/AuthClient"
import { translateApiError } from "@/lib/TranslateError"

type Step = "email" | "totp"

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

  const handleTotpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setPending(true)
    const result = useBackup
      ? await authClient.twoFactor.verifyBackupCode({ code })
      : await authClient.twoFactor.verifyTotp({ code })
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

  if (step === "totp") {
    return (
      <AuthCard
        title="Two-factor authentication"
        footer={
          <button
            type="button"
            className="text-primary underline"
            onClick={() => { setStep("email"); setCode(""); setErrorMessage(null) }}
          >
            Back to sign in
          </button>
        }
      >
        <form className="flex flex-col gap-3" onSubmit={handleTotpSubmit}>
          <p className="text-muted-foreground text-xs">
            {useBackup
              ? "Enter one of your backup codes."
              : "Enter the 6-digit code from your authenticator app."}
          </p>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">{useBackup ? "Backup code" : "Code"}</Label>
            <Input
              autoFocus
              required
              value={code}
              onChange={(e) =>
                setCode(useBackup ? e.target.value : e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder={useBackup ? "" : "000000"}
              maxLength={useBackup ? 32 : 6}
              className={useBackup ? "" : "font-mono tracking-widest text-center"}
              inputMode={useBackup ? "text" : "numeric"}
              autoComplete="one-time-code"
            />
          </div>
          {errorMessage !== null ? (
            <p className="text-destructive text-xs" role="alert">{errorMessage}</p>
          ) : null}
          <Button type="submit" disabled={pending || code === ""} className="mt-1 w-full">
            {pending ? "Verifying…" : "Verify"}
          </Button>
          <button
            type="button"
            className="text-muted-foreground text-xs underline"
            onClick={() => { setUseBackup(!useBackup); setCode(""); setErrorMessage(null) }}
          >
            {useBackup ? "Use authenticator code instead" : "Use a backup code instead"}
          </button>
        </form>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title={t("auth.login.title")}
      footer={
        <span>
          {t("auth.login.footer_new")}{" "}
          <Link to="/register" className="text-primary underline">
            {t("auth.login.footer_link")}
          </Link>
        </span>
      }
    >
      <form className="flex flex-col gap-3" onSubmit={handleEmailSubmit}>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">{t("auth.login.email_label")}</Label>
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email webauthn"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">{t("auth.login.password_label")}</Label>
          <Input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password webauthn"
          />
        </div>
        {errorMessage !== null ? (
          <p className="text-destructive text-xs" role="alert">{errorMessage}</p>
        ) : null}
        <Button type="submit" disabled={pending} className="mt-1 w-full">
          {pending ? t("auth.login.submitting") : t("auth.login.submit")}
        </Button>

        <div className="relative my-1">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-card px-2 text-[0.65rem] uppercase tracking-wider text-muted-foreground">
              or
            </span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => void handlePasskeySignIn()}
          className="w-full"
        >
          Sign in with a passkey
        </Button>
      </form>
    </AuthCard>
  )
}

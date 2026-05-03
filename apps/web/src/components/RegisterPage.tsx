import { useState } from "react"
import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { parseApiErrorBody } from "@workspace/shared/errors"

import { AuthCard } from "@/components/AuthCard"
import { authClient } from "@/lib/AuthClient"
import { translateApiError } from "@/lib/TranslateError"

/**
 * New-account flow. Better-auth requires email verification before sign-in
 * is allowed, so on success the page swaps to a confirmation state rather
 * than navigating into the panel.
 */
export const RegisterPage = () => {
  const { t } = useTranslation()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [completed, setCompleted] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setPending(true)
    const result = await authClient.signUp.email({ email, password, name })
    setPending(false)
    if (result.error !== null) {
      const parsed = parseApiErrorBody(JSON.stringify({ error: result.error }))
      setErrorMessage(
        parsed !== null
          ? translateApiError(t, parsed.error)
          : (result.error.message ?? t("internal.unexpected", { ns: "errors" }))
      )
      return
    }
    setCompleted(true)
  }

  if (completed) {
    return (
      <AuthCard
        title={t("auth.register.verify_title")}
        subtitle={t("auth.register.verify_subtitle")}
        footer={
          <Link to="/login" className="text-primary underline">
            {t("auth.register.verify_back")}
          </Link>
        }
      >
        <p className="text-sm">
          {t("auth.register.verify_body")}
        </p>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title={t("auth.register.title")}
      footer={
        <span>
          {t("auth.register.footer_existing")}{" "}
          <Link to="/login" className="text-primary underline">
            {t("auth.register.footer_link")}
          </Link>
        </span>
      }
    >
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">{t("auth.register.name_label")}</Label>
          <Input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">{t("auth.register.email_label")}</Label>
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">{t("auth.register.password_label")}</Label>
          <Input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        {errorMessage !== null ? (
          <p className="text-destructive text-xs" role="alert">
            {errorMessage}
          </p>
        ) : null}
        <Button type="submit" disabled={pending} className="mt-1 w-full">
          {pending ? t("auth.register.submitting") : t("auth.register.submit")}
        </Button>
      </form>
    </AuthCard>
  )
}

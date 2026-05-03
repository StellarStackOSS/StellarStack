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

/**
 * Email + password sign-in form. On success, navigates to `/dashboard`.
 * On failure, parses the response body via the shared `apiErrorSchema`
 * and surfaces a translated message via i18next so the canonical
 * translation-key envelope flow holds end to end.
 */
export const LoginPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setPending(true)
    const result = await authClient.signIn.email({ email, password })
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
    await navigate({ to: "/dashboard" })
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
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">{t("auth.login.email_label")}</Label>
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">{t("auth.login.password_label")}</Label>
          <Input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        {errorMessage !== null ? (
          <p className="text-destructive text-xs" role="alert">
            {errorMessage}
          </p>
        ) : null}
        <Button type="submit" disabled={pending} className="mt-1 w-full">
          {pending ? t("auth.login.submitting") : t("auth.login.submit")}
        </Button>
      </form>
    </AuthCard>
  )
}

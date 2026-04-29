import { useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import { Button } from "@workspace/ui/components/button"
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
      title="Sign in to StellarStack"
      footer={
        <span>
          New here?{" "}
          <Link to="/register" className="text-primary underline">
            Create an account
          </Link>
        </span>
      }
    >
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1 text-xs">
          <span>Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border-border bg-background h-8 rounded-md border px-2 text-sm"
            autoComplete="email"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span>Password</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border-border bg-background h-8 rounded-md border px-2 text-sm"
            autoComplete="current-password"
          />
        </label>
        {errorMessage !== null ? (
          <p className="text-destructive text-xs" role="alert">
            {errorMessage}
          </p>
        ) : null}
        <Button type="submit" disabled={pending} className="mt-1 w-full">
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthCard>
  )
}

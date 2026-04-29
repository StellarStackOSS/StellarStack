import { useState } from "react"
import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import { Button } from "@workspace/ui/components/button"
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
        title="Check your inbox"
        subtitle="We sent a verification email to confirm your address."
        footer={
          <Link to="/login" className="text-primary underline">
            Back to sign in
          </Link>
        }
      >
        <p className="text-sm">
          Click the link in the email to activate your account, then sign in.
        </p>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Create your account"
      footer={
        <span>
          Already have one?{" "}
          <Link to="/login" className="text-primary underline">
            Sign in
          </Link>
        </span>
      }
    >
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1 text-xs">
          <span>Name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border-border bg-background h-8 rounded-md border px-2 text-sm"
            autoComplete="name"
          />
        </label>
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
          <span>Password (8+ characters)</span>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border-border bg-background h-8 rounded-md border px-2 text-sm"
            autoComplete="new-password"
          />
        </label>
        {errorMessage !== null ? (
          <p className="text-destructive text-xs" role="alert">
            {errorMessage}
          </p>
        ) : null}
        <Button type="submit" disabled={pending} className="mt-1 w-full">
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthCard>
  )
}

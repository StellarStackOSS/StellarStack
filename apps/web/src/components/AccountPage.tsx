import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardInner,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

import { ApiFetchError } from "@/lib/ApiFetch"
import { authClient, useSession } from "@/lib/AuthClient"
import { dicebearAvatarUrl } from "@/lib/Avatar"
import { notify } from "@/lib/notify"
import { translateApiError } from "@/lib/TranslateError"
import { useChangePassword, useUpdateProfile } from "@/hooks/useProfile"

// ---------------------------------------------------------------------------
// Profile (name + avatar)
// ---------------------------------------------------------------------------

const LANGUAGES: Array<{ value: string; label: string }> = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "pt", label: "Português" },
  { value: "ja", label: "日本語" },
  { value: "zh", label: "中文" },
]

const TIMEZONES: string[] = (() => {
  // `Intl.supportedValuesOf` is widely supported (Node 18+, modern browsers).
  // Fall back to a small sane list if it's missing.
  try {
    const fn = (Intl as unknown as {
      supportedValuesOf?: (k: string) => string[]
    }).supportedValuesOf
    if (typeof fn === "function") return fn("timeZone")
  } catch {
    /* ignore */
  }
  return [
    "UTC", "Europe/London", "Europe/Berlin", "Europe/Paris", "America/New_York",
    "America/Los_Angeles", "America/Chicago", "Asia/Tokyo", "Asia/Singapore",
    "Australia/Sydney",
  ]
})()

const ProfileCard = () => {
  const { t } = useTranslation()
  const { data: session } = useSession()
  const update = useUpdateProfile()

  const user = session?.user
  const [name, setName] = useState(user?.name ?? "")
  const [image, setImage] = useState(user?.image ?? "")
  const [language, setLanguage] = useState(user?.preferredLocale ?? "en")
  const [timezone, setTimezone] = useState(
    user?.timezone ??
      Intl.DateTimeFormat().resolvedOptions().timeZone ??
      "UTC"
  )
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const effectiveImage = image !== "" ? image : dicebearAvatarUrl(name || (user?.name ?? "user"))

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setSaved(false)
    try {
      await update.mutateAsync({
        name: name.trim(),
        image: image.trim() === "" ? null : image.trim(),
        preferredLocale: language,
        timezone,
      })
      setSaved(true)
    } catch (err) {
      setError(
        err instanceof ApiFetchError
          ? translateApiError(t, err.body.error)
          : t("internal.unexpected", { ns: "errors" })
      )
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("profile.section.info")}</CardTitle>
        <CardDescription>{t("profile.section.info_description")}</CardDescription>
      </CardHeader>
      <CardInner className="p-3">
        <form onSubmit={(e) => void handleSave(e)} className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <Avatar className="size-14 rounded-lg">
              <AvatarImage
                src={effectiveImage}
                alt={name || (user?.name ?? "")}
                className="size-full rounded-lg object-cover"
              />
              <AvatarFallback className="rounded-lg text-base">
                {(name || (user?.name ?? "?"))[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs">{t("profile.field.avatar_url")}</Label>
              <Input
                type="url"
                value={image}
                onChange={(e) => setImage(e.target.value)}
                placeholder="Leave empty for an auto-generated avatar"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("profile.field.name")}</Label>
            <Input required value={name} onChange={(e) => setName(e.target.value)} maxLength={64} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("profile.field.email")}</Label>
            <Input value={user?.email ?? ""} disabled />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {error !== null && <p className="text-destructive text-xs" role="alert">{error}</p>}
          {saved && <p className="text-chart-1 text-xs">{t("profile.saved")}</p>}
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={update.isPending}>
              {update.isPending ? t("settings.saving") : t("actions.save")}
            </Button>
          </div>
        </form>
      </CardInner>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Password
// ---------------------------------------------------------------------------

const PasswordCard = () => {
  const { t } = useTranslation()
  const changePassword = useChangePassword()

  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setSaved(false)
    if (next !== confirm) { setError(t("profile.password_mismatch")); return }
    if (next.length < 8) { setError(t("profile.password_too_short")); return }
    try {
      await changePassword.mutateAsync({ currentPassword: current, newPassword: next })
      setCurrent(""); setNext(""); setConfirm("")
      setSaved(true)
    } catch {
      setError(t("auth.login.invalid_credentials"))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("profile.section.password")}</CardTitle>
        <CardDescription>{t("profile.section.password_description")}</CardDescription>
      </CardHeader>
      <CardInner className="p-3">
        <form onSubmit={(e) => void handleSave(e)} className="flex flex-col gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("profile.field.current_password")}</Label>
            <Input type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("profile.field.new_password")}</Label>
            <Input type="password" required value={next} onChange={(e) => setNext(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("profile.field.confirm_password")}</Label>
            <Input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          {error !== null && <p className="text-destructive text-xs" role="alert">{error}</p>}
          {saved && <p className="text-chart-1 text-xs">{t("profile.saved")}</p>}
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={changePassword.isPending}>
              {changePassword.isPending ? t("settings.saving") : t("profile.change_password")}
            </Button>
          </div>
        </form>
      </CardInner>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// 2FA
// ---------------------------------------------------------------------------

type TwoFaStep = "idle" | "setup" | "backup"

const TwoFactorCard = () => {
  const { data: session, refetch } = useSession()
  const enabled = session?.user?.twoFactorEnabled ?? false

  const [step, setStep] = useState<TwoFaStep>("idle")
  const [totpUri, setTotpUri] = useState("")
  const [qrDataUrl, setQrDataUrl] = useState("")
  const [code, setCode] = useState("")
  const [password, setPassword] = useState("")
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const openSetup = async () => {
    setError(null); setBusy(true)
    try {
      const res = await authClient.twoFactor.enable({ password })
      if (res.error) { setError(res.error.message ?? "Failed to start setup"); setBusy(false); return }
      const data = res.data as { totpURI?: string; backupCodes?: string[] } | null
      const uri = data?.totpURI ?? ""
      setTotpUri(uri)
      setBackupCodes(data?.backupCodes ?? [])
      const { toDataURL } = await import("qrcode")
      setQrDataUrl(await toDataURL(uri, { width: 200, margin: 1 }))
      setStep("setup")
    } catch { setError("Unexpected error. Try again.") }
    finally { setBusy(false) }
  }

  const verifyAndEnable = async () => {
    setError(null); setBusy(true)
    try {
      const verifyRes = await authClient.twoFactor.verifyTotp({ code })
      if (verifyRes.error) { setError(verifyRes.error.message ?? "Invalid code"); setBusy(false); return }
      await refetch()
      setStep("backup")
    } catch { setError("Unexpected error. Try again.") }
    finally { setBusy(false) }
  }

  const disable = async () => {
    setError(null); setBusy(true)
    try {
      const res = await authClient.twoFactor.disable({ password })
      if (res.error) { setError(res.error.message ?? "Failed to disable"); setBusy(false); return }
      await refetch()
      setPassword("")
      notify.success("Two-factor authentication disabled")
    } catch { setError("Unexpected error. Try again.") }
    finally { setBusy(false) }
  }

  const closeSetup = () => {
    setStep("idle"); setCode(""); setPassword("")
    setTotpUri(""); setQrDataUrl(""); setError(null)
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Two-factor authentication</CardTitle>
          <CardDescription>
            Protect your account with a TOTP authenticator app.
          </CardDescription>
          <CardAction>
            <Badge variant={enabled ? "default" : "secondary"}>
              {enabled ? "Enabled" : "Disabled"}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardInner className="p-3">
          {enabled ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Current password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Required to disable 2FA"
                />
              </div>
              {error !== null && <p className="text-destructive text-xs">{error}</p>}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busy || password === ""}
                  onClick={() => void disable()}
                >
                  Disable 2FA
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || password === ""}
                  onClick={() => void openSetup()}
                >
                  View setup / regenerate
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Current password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Required to enable 2FA"
                />
              </div>
              {error !== null && <p className="text-destructive text-xs">{error}</p>}
              <div>
                <Button
                  size="sm"
                  disabled={busy || password === ""}
                  onClick={() => void openSetup()}
                >
                  Enable 2FA
                </Button>
              </div>
            </div>
          )}
        </CardInner>
      </Card>

      <Dialog open={step === "setup"} onOpenChange={(v) => { if (!v) closeSetup() }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Set up authenticator</DialogTitle>
            <DialogDescription>
              Scan this QR code with your authenticator app, then enter the 6-digit code.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            {qrDataUrl !== "" && (
              <img src={qrDataUrl} alt="TOTP QR code" className="rounded-lg border border-border" />
            )}
            <p className="w-full break-all rounded bg-muted px-2 py-1 font-mono text-[0.6rem] text-muted-foreground select-all">
              {totpUri}
            </p>
            <div className="w-full space-y-1.5">
              <Label className="text-xs">Verification code</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="font-mono tracking-widest text-center"
              />
            </div>
            {error !== null && <p className="text-destructive text-xs w-full">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={closeSetup} disabled={busy}>Cancel</Button>
            <Button size="sm" disabled={busy || code.length !== 6} onClick={() => void verifyAndEnable()}>
              {busy ? "Verifying…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={step === "backup"} onOpenChange={(v) => { if (!v) closeSetup() }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Save your backup codes</DialogTitle>
            <DialogDescription>
              Store these somewhere safe. Each code can only be used once if you lose access to your authenticator.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-border bg-muted/40 p-3">
            {backupCodes.map((c) => (
              <span key={c} className="font-mono text-xs text-foreground">{c}</span>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(backupCodes.join("\n"))
                notify.success("Copied to clipboard")
              }}
            >
              Copy all
            </Button>
            <Button size="sm" onClick={closeSetup}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ---------------------------------------------------------------------------
// Passkeys
// ---------------------------------------------------------------------------

type PasskeyEntry = {
  id: string
  name?: string | null
  createdAt?: string | null
  deviceType?: string
}

const PasskeysCard = () => {
  const [passkeys, setPasskeys] = useState<PasskeyEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [addBusy, setAddBusy] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ranOnce = useRef(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await authClient.passkey.listUserPasskeys()
      setPasskeys((res.data as PasskeyEntry[] | null) ?? [])
    } catch { /* ignore */ } finally { setLoading(false) }
  }

  useEffect(() => {
    if (ranOnce.current) return
    ranOnce.current = true
    void load()
  }, [])

  const addPasskey = async () => {
    setError(null); setAddBusy(true)
    try {
      const res = await authClient.passkey.addPasskey()
      if (res?.error) { setError(res.error.message ?? "Failed to add passkey"); return }
      notify.success("Passkey added")
      await load()
    } catch { setError("Passkey registration failed or was cancelled.") }
    finally { setAddBusy(false) }
  }

  const deletePasskey = async (id: string) => {
    setDeleteBusy(id)
    try {
      await authClient.passkey.deletePasskey({ id })
      notify.success("Passkey removed")
      await load()
    } catch { notify.error("Failed to remove passkey") }
    finally { setDeleteBusy(null) }
  }

  const formatDate = (v?: string | null) => {
    if (!v) return "—"
    return new Date(v).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Passkeys</CardTitle>
        <CardDescription>
          Sign in with Face ID, Touch ID, or a hardware security key.
        </CardDescription>
        <CardAction>
          <Button size="sm" disabled={addBusy} onClick={() => void addPasskey()}>
            {addBusy ? "Registering…" : "Add passkey"}
          </Button>
        </CardAction>
      </CardHeader>
      <CardInner className="p-0">
        {loading ? (
          <p className="px-3 py-4 text-xs text-muted-foreground">Loading…</p>
        ) : passkeys.length === 0 ? (
          <p className="px-3 py-4 text-xs text-muted-foreground">No passkeys registered.</p>
        ) : (
          <ul className="divide-y divide-border">
            {passkeys.map((pk) => (
              <li key={pk.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium">
                    {pk.name ?? "Unnamed passkey"}
                  </span>
                  <span className="text-[0.65rem] text-muted-foreground">
                    {pk.deviceType ?? "unknown"} · Added {formatDate(pk.createdAt)}
                  </span>
                </div>
                <Button
                  size="xs"
                  variant="destructive"
                  disabled={deleteBusy === pk.id}
                  onClick={() => void deletePasskey(pk.id)}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
        {error !== null && (
          <p className="px-3 pb-3 text-xs text-destructive">{error}</p>
        )}
      </CardInner>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Notifications (placeholder)
// ---------------------------------------------------------------------------

const NotificationsCard = () => (
  <Card>
    <CardHeader>
      <CardTitle>Notifications</CardTitle>
      <CardDescription>
        Choose how you want to be notified about server events.
      </CardDescription>
    </CardHeader>
    <CardInner className="p-4">
      <p className="text-muted-foreground text-xs">
        Notification preferences coming soon.
      </p>
    </CardInner>
  </Card>
)

// ---------------------------------------------------------------------------
// Connections (placeholder)
// ---------------------------------------------------------------------------

const ConnectionsCard = () => (
  <Card>
    <CardHeader>
      <CardTitle>Connections</CardTitle>
      <CardDescription>
        Linked accounts and external integrations.
      </CardDescription>
    </CardHeader>
    <CardInner className="p-4">
      <p className="text-muted-foreground text-xs">
        Connections will appear here once integrations are available.
      </p>
    </CardInner>
  </Card>
)

// ---------------------------------------------------------------------------
// Pages — one per top-level sidebar entry
// ---------------------------------------------------------------------------

export const AccountPage = () => (
  <div className="flex flex-col gap-4">
    <ProfileCard />
    <PasswordCard />
    <TwoFactorCard />
    <PasskeysCard />
  </div>
)

export const AccountNotificationsPage = () => (
  <div className="flex flex-col gap-4">
    <NotificationsCard />
  </div>
)

export const AccountConnectionsPage = () => (
  <div className="flex flex-col gap-4">
    <ConnectionsCard />
  </div>
)

import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardInner,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

import { ApiFetchError } from "@/lib/ApiFetch"
import { translateApiError } from "@/lib/TranslateError"
import { useSession } from "@/lib/AuthClient"
import { useUpdateProfile, useChangePassword } from "@/hooks/useProfile"

const initials = (name: string): string => {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  if (parts.length === 0) return "?"
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?"
}

const ProfileCard = () => {
  const { t } = useTranslation()
  const { data: session } = useSession()
  const update = useUpdateProfile()

  const user = session?.user
  const [name, setName] = useState(user?.name ?? "")
  const [image, setImage] = useState(user?.image ?? "")
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setSaved(false)
    try {
      await update.mutateAsync({
        name: name.trim(),
        image: image.trim() === "" ? null : image.trim(),
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
              {image !== "" ? (
                <img src={image} alt={name} className="size-full rounded-lg object-cover" />
              ) : null}
              <AvatarFallback className="rounded-lg text-base">{initials(name || (user?.name ?? ""))}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs">{t("profile.field.avatar_url")}</Label>
              <Input
                type="url"
                value={image}
                onChange={(e) => setImage(e.target.value)}
                placeholder="https://example.com/avatar.jpg"
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
    if (next !== confirm) {
      setError(t("profile.password_mismatch"))
      return
    }
    if (next.length < 8) {
      setError(t("profile.password_too_short"))
      return
    }
    try {
      await changePassword.mutateAsync({ currentPassword: current, newPassword: next })
      setCurrent("")
      setNext("")
      setConfirm("")
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

export const ProfilePage = () => {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-base font-semibold">{t("profile.title")}</h1>
        <p className="text-muted-foreground text-xs">{t("profile.description")}</p>
      </header>
      <ProfileCard />
      <PasswordCard />
    </div>
  )
}

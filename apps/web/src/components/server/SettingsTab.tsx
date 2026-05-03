import { useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardInner,
  CardTitle,
} from "@workspace/ui/components/card"
import { Checkbox } from "@workspace/ui/components/checkbox"
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
import { translateApiError } from "@/lib/TranslateError"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { useServerLayout } from "@/components/ServerLayoutContext"
import { useBlueprints } from "@/hooks/useBlueprints"
import {
  useChangeBlueprintServer,
  useReinstallServer,
  useRenameServer,
} from "@/hooks/useServerSettings"

export const SettingsTab = () => {
  const { t } = useTranslation()
  const { server } = useServerLayout()
  const navigate = useNavigate()

  const rename = useRenameServer(server.id)
  const changeBlueprint = useChangeBlueprintServer(server.id)
  const reinstall = useReinstallServer(server.id)

  const { data: blueprintsData } = useBlueprints()
  const blueprints = blueprintsData?.blueprints ?? []

  const [name, setName] = useState(server.name)
  const [renameError, setRenameError] = useState<string | null>(null)

  const [blueprintId, setBlueprintId] = useState(server.blueprintId)
  const [dockerImage, setDockerImage] = useState(server.dockerImage)
  const [blueprintError, setBlueprintError] = useState<string | null>(null)

  const [keepFiles, setKeepFiles] = useState(false)
  const [snapshotFirst, setSnapshotFirst] = useState(true)
  const [reinstallOpen, setReinstallOpen] = useState(false)
  const [reinstallError, setReinstallError] = useState<string | null>(null)

  const selectedBlueprint = blueprints.find((b) => b.id === blueprintId)
  const imageOptions = selectedBlueprint
    ? Object.entries(selectedBlueprint.dockerImages as Record<string, string>)
    : []

  const handleRename = async () => {
    setRenameError(null)
    try {
      await rename.mutateAsync({ name })
    } catch (err) {
      setRenameError(
        err instanceof ApiFetchError
          ? translateApiError(t, err.body.error)
          : t("internal.unexpected", { ns: "errors" })
      )
    }
  }

  const handleBlueprintSave = async () => {
    setBlueprintError(null)
    try {
      await changeBlueprint.mutateAsync({ blueprintId, dockerImage })
    } catch (err) {
      setBlueprintError(
        err instanceof ApiFetchError
          ? translateApiError(t, err.body.error)
          : t("internal.unexpected", { ns: "errors" })
      )
    }
  }

  const handleReinstall = async () => {
    setReinstallError(null)
    try {
      await reinstall.mutateAsync({ keepFiles, snapshotFirst })
      await navigate({ to: "/servers/$id", params: { id: server.id } })
    } catch (err) {
      setReinstallError(
        err instanceof ApiFetchError
          ? translateApiError(t, err.body.error)
          : t("internal.unexpected", { ns: "errors" })
      )
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{t("settings.title")}</CardTitle>
        </CardHeader>
        <CardInner className="p-3">
          <p className="text-sm text-muted-foreground">{t("settings.description")}</p>
        </CardInner>
      </Card>

      {/* rename */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.rename_title")}</CardTitle>
          <CardDescription>{t("settings.rename_description")}</CardDescription>
        </CardHeader>
        <CardInner className="p-3 flex flex-col gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="server-name">{t("settings.name_label")}</Label>
            <Input
              id="server-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={64}
            />
          </div>
          {renameError !== null && (
            <p className="text-destructive text-xs" role="alert">{renameError}</p>
          )}
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={rename.isPending || name.trim().length === 0 || name === server.name}
              onClick={() => void handleRename()}
            >
              {rename.isPending ? t("settings.saving") : t("actions.save")}
            </Button>
          </div>
          </CardInner>
      </Card>

      {/* blueprint */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.blueprint_title")}</CardTitle>
          <CardDescription>{t("settings.blueprint_description")}</CardDescription>
        </CardHeader>
        <CardInner className="p-3 flex flex-col gap-3">
          <div className="space-y-1.5">
            <Label>{t("settings.blueprint_label")}</Label>
            <Select
              value={blueprintId}
              onValueChange={(v) => {
                setBlueprintId(v)
                setDockerImage("")
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("settings.blueprint_placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {blueprints.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("settings.docker_image_label")}</Label>
            <Select
              value={dockerImage}
              onValueChange={setDockerImage}
              disabled={imageOptions.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("settings.docker_image_placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {imageOptions.map(([label, image]) => (
                  <SelectItem key={image} value={image}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {blueprintError !== null && (
            <p className="text-destructive text-xs" role="alert">{blueprintError}</p>
          )}
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={
                changeBlueprint.isPending ||
                !dockerImage ||
                (blueprintId === server.blueprintId && dockerImage === server.dockerImage)
              }
              onClick={() => void handleBlueprintSave()}
            >
              {changeBlueprint.isPending ? t("settings.blueprint_saving") : t("settings.blueprint_save")}
            </Button>
          </div>
          </CardInner>
      </Card>

      {/* reinstall */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.reinstall_title")}</CardTitle>
          <CardDescription>{t("settings.reinstall_description")}</CardDescription>
        </CardHeader>
        <CardInner className="p-3 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="keep-files"
              checked={keepFiles}
              onCheckedChange={(v) => setKeepFiles(v === true)}
            />
            <Label htmlFor="keep-files">{t("settings.reinstall_keep_files")}</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="snapshot-first"
              checked={snapshotFirst}
              onCheckedChange={(v) => setSnapshotFirst(v === true)}
            />
            <Label htmlFor="snapshot-first">{t("settings.reinstall_snapshot")}</Label>
          </div>
          {reinstallError !== null && (
            <p className="text-destructive text-xs" role="alert">{reinstallError}</p>
          )}
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="secondary"
              disabled={reinstall.isPending}
              onClick={() => setReinstallOpen(true)}
            >
              {t("settings.reinstall_button")}
            </Button>
          </div>
          </CardInner>
      </Card>

      <ConfirmDialog
        open={reinstallOpen}
        onOpenChange={setReinstallOpen}
        title={t("settings.reinstall_title")}
        description={t("settings.reinstall_confirm")}
        confirmLabel={t("settings.reinstall_button")}
        variant="destructive"
        onConfirm={handleReinstall}
      />
    </div>
  )
}

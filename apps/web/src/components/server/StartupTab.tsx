import { useState } from "react"
import { useTranslation } from "react-i18next"
import type { TFunction } from "i18next"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

import { ApiFetchError } from "@/lib/ApiFetch"
import { translateApiError } from "@/lib/TranslateError"
import { useServerLayout } from "@/components/ServerLayoutContext"
import {
  useServerVariables,
  useUpdateDockerImage,
  useUpdateServerVariables,
  useUpdateStartupExtra,
} from "@/hooks/useServerVariables"
import type { ServerVariable } from "@/hooks/useServerVariables.types"

const resolveText = (
  t: TFunction,
  text: string | { key: string; params?: Record<string, string | number | boolean> } | undefined
): string => {
  if (text === undefined) return ""
  if (typeof text === "string") return text
  return t(text.key, text.params)
}

export const StartupTab = () => {
  const { t } = useTranslation()
  const { server } = useServerLayout()

  const { data, isLoading } = useServerVariables(server.id)
  const updateVariables = useUpdateServerVariables(server.id)
  const updateStartupExtra = useUpdateStartupExtra(server.id)
  const updateDockerImage = useUpdateDockerImage(server.id)

  const viewableVariables = (data?.variables ?? []).filter(
    (v: ServerVariable) => v.userViewable
  )

  const hasImagePicker = "java_version_picker" in (data?.features ?? {})
  const dockerImageOptions = Object.entries(data?.dockerImages ?? {})

  const [pending, setPending] = useState<Record<string, string>>({})
  const [variablesError, setVariablesError] = useState<string | null>(null)

  const [extraDraft, setExtraDraft] = useState<string | null>(null)
  const [extraError, setExtraError] = useState<string | null>(null)

  const [imageDraft, setImageDraft] = useState<string | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)

  const imageValue = imageDraft !== null ? imageDraft : (data?.dockerImage ?? "")
  const imageDirty = imageDraft !== null && imageDraft !== (data?.dockerImage ?? "")

  const extraValue = extraDraft !== null ? extraDraft : (data?.startupExtra ?? "")
  const extraDirty = extraDraft !== null && extraDraft !== (data?.startupExtra ?? "")

  const getValue = (v: ServerVariable): string =>
    pending[v.key] !== undefined ? pending[v.key] : v.currentValue

  const hasDirty = viewableVariables.some(
    (v) => pending[v.key] !== undefined && pending[v.key] !== v.currentValue
  )

  const handleSaveVariables = async () => {
    setVariablesError(null)
    const payload: Record<string, string> = {}
    for (const v of viewableVariables) {
      if (pending[v.key] !== undefined) {
        payload[v.key] = pending[v.key]
      }
    }
    try {
      await updateVariables.mutateAsync(payload)
      setPending({})
    } catch (err) {
      setVariablesError(
        err instanceof ApiFetchError
          ? translateApiError(t, err.body.error)
          : t("internal.unexpected", { ns: "errors" })
      )
    }
  }

  const handleSaveExtra = async () => {
    setExtraError(null)
    try {
      await updateStartupExtra.mutateAsync(extraValue)
      setExtraDraft(null)
    } catch (err) {
      setExtraError(
        err instanceof ApiFetchError
          ? translateApiError(t, err.body.error)
          : t("internal.unexpected", { ns: "errors" })
      )
    }
  }

  const handleSaveImage = async () => {
    setImageError(null)
    try {
      await updateDockerImage.mutateAsync(imageValue)
      setImageDraft(null)
    } catch (err) {
      setImageError(
        err instanceof ApiFetchError
          ? translateApiError(t, err.body.error)
          : t("internal.unexpected", { ns: "errors" })
      )
    }
  }

  const previewCommand = [data?.startupCommand, extraValue.trim()]
    .filter(Boolean)
    .join(" ")

  return (
    <div className="flex flex-col gap-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{t("startup.title")}</CardTitle>
        </CardHeader>
        <CardInner className="p-3">
          <p className="text-sm text-muted-foreground">{t("startup.description")}</p>
        </CardInner>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("startup.command_heading")}</CardTitle>
          <CardDescription>{t("startup.command_description")}</CardDescription>
        </CardHeader>
        <CardInner className="p-3 flex flex-col gap-3">
          <div className="space-y-1.5">
            <Label>{t("startup.base_command_label")}</Label>
            <Input
              readOnly
              value={data?.startupCommand ?? ""}
              className="font-mono text-xs text-muted-foreground"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="startup-extra">{t("startup.extra_label")}</Label>
            <Input
              id="startup-extra"
              value={extraValue}
              onChange={(e) => setExtraDraft(e.target.value)}
              placeholder={t("startup.extra_placeholder")}
              className="font-mono text-xs"
            />
            <p className="text-muted-foreground text-xs">{t("startup.extra_description")}</p>
          </div>
          {extraValue.trim() !== "" && (
            <div className="space-y-1.5">
              <Label>{t("startup.preview_label")}</Label>
              <p className="bg-muted rounded px-3 py-2 font-mono text-xs break-all">
                {previewCommand}
              </p>
            </div>
          )}
          {extraError !== null && (
            <p className="text-destructive text-xs" role="alert">{extraError}</p>
          )}
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={updateStartupExtra.isPending || !extraDirty}
              onClick={() => void handleSaveExtra()}
            >
              {updateStartupExtra.isPending ? t("startup.saving") : t("startup.save_extra")}
            </Button>
          </div>
          </CardInner>
      </Card>

      {hasImagePicker && (
        <Card>
          <CardHeader>
            <CardTitle>{t("startup.image_heading")}</CardTitle>
            <CardDescription>{t("startup.image_description")}</CardDescription>
          </CardHeader>
          <CardInner className="p-3 flex flex-col gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="docker-image">{t("startup.image_label")}</Label>
              <Select value={imageValue} onValueChange={(v) => setImageDraft(v)}>
                <SelectTrigger id="docker-image" className="font-mono text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dockerImageOptions.map(([label, image]) => (
                    <SelectItem key={image} value={image} className="font-mono text-xs">
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {imageError !== null && (
              <p className="text-destructive text-xs" role="alert">{imageError}</p>
            )}
            <div className="flex justify-end">
              <Button
                size="sm"
                disabled={updateDockerImage.isPending || !imageDirty}
                onClick={() => void handleSaveImage()}
              >
                {updateDockerImage.isPending ? t("startup.saving") : t("startup.save_image")}
              </Button>
            </div>
            </CardInner>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("startup.variables_heading")}</CardTitle>
          <CardDescription>{t("startup.variables_description")}</CardDescription>
        </CardHeader>
        <CardInner className="p-3 flex flex-col gap-4">
          {isLoading ? (
            <p className="text-muted-foreground text-xs">{t("startup.loading")}</p>
          ) : viewableVariables.length === 0 ? (
            <p className="text-muted-foreground text-xs">{t("startup.no_variables")}</p>
          ) : (
            viewableVariables.map((v) => (
              <div key={v.key} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <Label htmlFor={`var-${v.key}`}>
                    {resolveText(t, v.name)}
                  </Label>
                  {!v.userEditable && (
                    <span className="bg-muted rounded px-1 py-0.5 text-[0.6rem] uppercase">
                      {t("startup.readonly_badge")}
                    </span>
                  )}
                </div>
                <Input
                  id={`var-${v.key}`}
                  value={getValue(v)}
                  disabled={!v.userEditable}
                  onChange={(e) => setPending((prev) => ({ ...prev, [v.key]: e.target.value }))}
                  className="text-xs"
                />
                {v.description !== undefined && (
                  <p className="text-muted-foreground text-xs">
                    {resolveText(t, v.description)}
                  </p>
                )}
              </div>
            ))
          )}
          {variablesError !== null && (
            <p className="text-destructive text-xs" role="alert">{variablesError}</p>
          )}
          {viewableVariables.length > 0 && (
            <div className="flex justify-end">
              <Button
                size="sm"
                disabled={updateVariables.isPending || !hasDirty}
                onClick={() => void handleSaveVariables()}
              >
                {updateVariables.isPending ? t("startup.saving") : t("startup.save_variables")}
              </Button>
            </div>
          )}
          </CardInner>
      </Card>
    </div>
  )
}

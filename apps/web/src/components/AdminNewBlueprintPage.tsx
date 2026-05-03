import { useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardHeader,
  CardInner,
  CardTitle,
} from "@workspace/ui/components/card"
import { blueprintSchema } from "@workspace/shared/blueprint"
import type { Blueprint } from "@workspace/shared/blueprint.types"

import { ApiFetchError } from "@/lib/ApiFetch"
import { translateApiError } from "@/lib/TranslateError"
import { useCreateBlueprint } from "@/hooks/useBlueprints"

const blankBlueprint: Blueprint = {
  schemaVersion: 1,
  name: "New blueprint",
  dockerImages: { Default: "ghcr.io/example/server:latest" },
  stopSignal: "SIGTERM",
  startupCommand: "./run.sh",
  variables: [],
  install: {
    image: "ghcr.io/stellarstack/installers:debian",
    entrypoint: "bash",
    script: "#!/usr/bin/env bash\nset -euo pipefail\n",
  },
  lifecycle: {
    starting: {
      probes: [{ strategy: "tcp", port: "{{SERVER_PORT}}" }],
      intervalMs: 2000,
      timeoutMs: 60_000,
      onTimeout: "mark_crashed",
    },
    stopping: {
      probes: [{ strategy: "container_exit" }],
      graceTimeoutMs: 30_000,
      onTimeout: "force_kill",
    },
    crashDetection: {
      probes: [{ strategy: "container_exit", ifNotInState: ["stopping", "stopped"] }],
    },
  },
}

export const AdminNewBlueprintPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const create = useCreateBlueprint()

  const [draftJson, setDraftJson] = useState(() => JSON.stringify(blankBlueprint, null, 2))
  const [errors, setErrors] = useState<string[]>([])
  const [saveError, setSaveError] = useState<string | null>(null)

  const parseDraft = (): Blueprint | null => {
    let raw: unknown
    try {
      raw = JSON.parse(draftJson)
    } catch {
      setErrors([t("blueprints.parse.invalid_json", { ns: "errors" })])
      return null
    }
    const result = blueprintSchema.safeParse(raw)
    if (!result.success) {
      setErrors(result.error.issues.map((issue) =>
        `${issue.path.length === 0 ? "(root)" : issue.path.join(".")}: ${issue.message}`
      ))
      return null
    }
    setErrors([])
    return result.data
  }

  const handleSave = async () => {
    setSaveError(null)
    const parsed = parseDraft()
    if (parsed === null) return
    try {
      const result = await create.mutateAsync(parsed)
      void result
      void navigate({ to: "/admin/blueprints" as string })
    } catch (err) {
      if (err instanceof ApiFetchError) {
        const fields = err.body.error.fields
        if (fields !== undefined && fields.length > 0) {
          setErrors(fields.map((field) =>
            `${field.path}: ${t(field.code, { ns: "validation", defaultValue: field.code, ...(field.params ?? {}) })}`
          ))
          return
        }
        setSaveError(translateApiError(t, err.body.error))
        return
      }
      setSaveError(t("internal.unexpected", { ns: "errors" }))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-base font-semibold">{t("blueprints.new_title")}</h1>
          <p className="text-muted-foreground text-xs">{t("blueprints.create_description")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void navigate({ to: "/admin/blueprints" as string })}>
          {t("actions.cancel")}
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{t("blueprints.editor_heading")}</CardTitle>
        </CardHeader>
        <CardInner className="p-3 flex flex-col gap-3">
          <textarea
            value={draftJson}
            onChange={(e) => setDraftJson(e.target.value)}
            spellCheck={false}
            className="border-border bg-background min-h-[32rem] w-full rounded-md border p-3 font-mono text-xs"
          />
          {errors.length > 0 && (
            <div className="border-destructive bg-destructive/10 text-destructive rounded border px-3 py-2 text-xs" role="alert">
              <p className="mb-1 font-medium">{t("blueprints.schema_errors_heading")}</p>
              <ul className="list-disc space-y-0.5 pl-4">
                {errors.map((message, index) => <li key={index}>{message}</li>)}
              </ul>
            </div>
          )}
          {saveError !== null && (
            <p className="text-destructive text-xs" role="alert">{saveError}</p>
          )}
          </CardInner>
      </Card>

      <div className="flex justify-end">
        <Button disabled={create.isPending} onClick={() => void handleSave()}>
          {create.isPending ? t("settings.saving") : t("blueprints.create_button")}
        </Button>
      </div>
    </div>
  )
}

import { useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import { Button } from "@workspace/ui/components/button"
import { blueprintSchema } from "@workspace/shared/blueprint"
import type { Blueprint } from "@workspace/shared/blueprint.types"

import { ApiFetchError } from "@/lib/ApiFetch"
import { translateApiError } from "@/lib/TranslateError"
import { authClient, useSession } from "@/lib/AuthClient"
import {
  useBlueprints,
  useCreateBlueprint,
  useDeleteBlueprint,
  useUpdateBlueprint,
} from "@/hooks/useBlueprints"
import type { BlueprintListRow } from "@/hooks/useBlueprints.types"

const blueprintRowToBlueprint = (row: BlueprintListRow): Blueprint => ({
  schemaVersion: 1,
  name: row.name,
  description: row.description,
  author: row.author,
  dockerImages: row.dockerImages,
  stopSignal: row.stopSignal,
  startupCommand: row.startupCommand,
  configFiles: row.configFiles,
  variables: row.variables,
  install: {
    image: row.installImage,
    entrypoint: row.installEntrypoint,
    script: row.installScript,
  },
  lifecycle: row.lifecycle,
  features: row.features,
})

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
      probes: [
        { strategy: "container_exit", ifNotInState: ["stopping", "stopped"] },
      ],
    },
  },
}

const stringifyName = (name: BlueprintListRow["name"]): string =>
  typeof name === "string" ? name : `[${name.key}]`

/**
 * Admin-only blueprint browser + JSON editor. Validation runs client-side
 * via the same Zod schema the API enforces, so an invalid edit short-circuits
 * before the round-trip; any server-side rejection still surfaces through
 * the canonical translation-key envelope.
 */
export const AdminBlueprintsPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: session, isPending } = useSession()
  const blueprintsQuery = useBlueprints()
  const createMutation = useCreateBlueprint()
  const updateMutation = useUpdateBlueprint()
  const deleteMutation = useDeleteBlueprint()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draftJson, setDraftJson] = useState<string>(() =>
    JSON.stringify(blankBlueprint, null, 2)
  )
  const [errors, setErrors] = useState<string[]>([])
  const [saveError, setSaveError] = useState<string | null>(null)

  if (isPending) {
    return (
      <div className="bg-background text-foreground flex min-h-svh items-center justify-center text-sm">
        Loading session…
      </div>
    )
  }

  if (session === null || session.user.isAdmin !== true) {
    return (
      <div className="bg-background text-foreground flex min-h-svh items-center justify-center text-sm">
        <div className="text-center">
          <p>You don&apos;t have access to this page.</p>
          <Link
            to="/dashboard"
            className="text-primary mt-2 inline-block underline"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    )
  }

  const handleSelect = (row: BlueprintListRow) => {
    setSelectedId(row.id)
    setDraftJson(JSON.stringify(blueprintRowToBlueprint(row), null, 2))
    setErrors([])
    setSaveError(null)
  }

  const handleNew = () => {
    setSelectedId(null)
    setDraftJson(JSON.stringify(blankBlueprint, null, 2))
    setErrors([])
    setSaveError(null)
  }

  const parseDraft = (): Blueprint | null => {
    let raw: unknown
    try {
      raw = JSON.parse(draftJson)
    } catch (err) {
      setErrors([
        `JSON parse error: ${err instanceof Error ? err.message : "unknown"}`,
      ])
      return null
    }
    const result = blueprintSchema.safeParse(raw)
    if (!result.success) {
      setErrors(
        result.error.issues.map(
          (issue) =>
            `${issue.path.length === 0 ? "(root)" : issue.path.join(".")}: ${issue.message}`
        )
      )
      return null
    }
    setErrors([])
    return result.data
  }

  const handleSave = async () => {
    setSaveError(null)
    const parsed = parseDraft()
    if (parsed === null) {
      return
    }
    try {
      if (selectedId !== null) {
        await updateMutation.mutateAsync({ id: selectedId, body: parsed })
      } else {
        const created = await createMutation.mutateAsync(parsed)
        setSelectedId(created.blueprint.id)
      }
    } catch (err) {
      if (err instanceof ApiFetchError) {
        const fields = err.body.error.fields
        if (fields !== undefined && fields.length > 0) {
          setErrors(
            fields.map(
              (field) =>
                `${field.path}: ${t(field.code, {
                  ns: "validation",
                  defaultValue: field.code,
                  ...(field.params ?? {}),
                })}`
            )
          )
          return
        }
        setSaveError(translateApiError(t, err.body.error))
        return
      }
      if (err instanceof Error) {
        setSaveError(err.message)
      }
    }
  }

  const handleDelete = async () => {
    if (selectedId === null) {
      return
    }
    if (!window.confirm("Delete this blueprint? This cannot be undone.")) {
      return
    }
    await deleteMutation.mutateAsync(selectedId)
    handleNew()
  }

  const handleSignOut = async () => {
    await authClient.signOut()
    await navigate({ to: "/login" })
  }

  const rows = blueprintsQuery.data?.blueprints ?? []

  return (
    <div className="bg-background text-foreground flex min-h-svh flex-col">
      <header className="border-border flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="text-base font-semibold">StellarStack — Blueprints</h1>
          <p className="text-muted-foreground text-xs">
            Signed in as {session.user.email}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/dashboard">
            <Button variant="outline" size="sm">
              Dashboard
            </Button>
          </Link>
          <Link to="/admin/nodes">
            <Button variant="outline" size="sm">
              Nodes
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            Sign out
          </Button>
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-6 p-6 md:grid-cols-[18rem_1fr]">
        <aside className="border-border bg-card text-card-foreground flex flex-col gap-2 rounded-md border p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Blueprints</h2>
            <Button size="xs" variant="outline" onClick={handleNew}>
              + New
            </Button>
          </div>
          {blueprintsQuery.isLoading ? (
            <p className="text-muted-foreground text-xs">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              No blueprints yet. Use “+ New” to create one.
            </p>
          ) : (
            <ul className="flex flex-col">
              {rows.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(row)}
                    className={`w-full rounded px-2 py-1 text-left text-xs ${
                      selectedId === row.id
                        ? "bg-muted text-foreground"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="font-medium">{stringifyName(row.name)}</div>
                    <div className="text-muted-foreground">
                      {Object.keys(row.dockerImages).length} image
                      {Object.keys(row.dockerImages).length === 1 ? "" : "s"} ·{" "}
                      {row.variables.length} variable
                      {row.variables.length === 1 ? "" : "s"}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
        <section className="border-border bg-card text-card-foreground flex flex-col gap-3 rounded-md border p-4">
          <header className="flex items-center justify-between">
            <h2 className="text-sm font-medium">
              {selectedId !== null ? "Edit blueprint" : "New blueprint"}
            </h2>
            <div className="flex gap-2">
              {selectedId !== null ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                >
                  Delete
                </Button>
              ) : null}
              <Button
                size="sm"
                onClick={handleSave}
                disabled={
                  createMutation.isPending || updateMutation.isPending
                }
              >
                {selectedId !== null ? "Save changes" : "Create"}
              </Button>
            </div>
          </header>
          <textarea
            value={draftJson}
            onChange={(e) => setDraftJson(e.target.value)}
            spellCheck={false}
            className="border-border bg-background min-h-[24rem] rounded-md border p-3 font-mono text-xs"
          />
          {errors.length > 0 ? (
            <div
              className="border-destructive bg-destructive/10 text-destructive rounded border px-3 py-2 text-xs"
              role="alert"
            >
              <p className="mb-1 font-medium">Schema errors</p>
              <ul className="list-disc space-y-0.5 pl-4">
                {errors.map((message, index) => (
                  <li key={index}>{message}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {saveError !== null ? (
            <p className="text-destructive text-xs" role="alert">
              {saveError}
            </p>
          ) : null}
        </section>
      </main>
    </div>
  )
}

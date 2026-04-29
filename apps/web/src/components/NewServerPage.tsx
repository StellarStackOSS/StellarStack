import { useMemo, useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import { Button } from "@workspace/ui/components/button"

import { ApiFetchError } from "@/lib/ApiFetch"
import { translateApiError } from "@/lib/TranslateError"
import { useBlueprints } from "@/hooks/useBlueprints"
import { useNodes } from "@/hooks/useNodes"
import { useCreateServer } from "@/hooks/useServers"
import type { CreateServerRequest } from "@/hooks/useServers.types"

/**
 * Server provisioning wizard. Pulls the blueprint + node lists from the
 * admin endpoints (which already gate on the session). The form drives a
 * `POST /servers`; on success the user lands on the new server's detail
 * page where the panel-event WS reflects status transitions live.
 */
export const NewServerPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const blueprintsQuery = useBlueprints()
  const nodesQuery = useNodes()
  const createServer = useCreateServer()

  const [blueprintId, setBlueprintId] = useState("")
  const [nodeId, setNodeId] = useState("")
  const [name, setName] = useState("")
  const [memoryLimitMb, setMemoryLimitMb] = useState(1024)
  const [cpuLimitPercent, setCpuLimitPercent] = useState(100)
  const [diskLimitMb, setDiskLimitMb] = useState(5_000)
  const [variables, setVariables] = useState<Record<string, string>>({})
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<string[]>([])

  const blueprint = useMemo(
    () =>
      blueprintsQuery.data?.blueprints.find((b) => b.id === blueprintId) ??
      null,
    [blueprintsQuery.data, blueprintId]
  )

  const dockerImageOptions = useMemo(
    () => Object.entries(blueprint?.dockerImages ?? {}),
    [blueprint]
  )
  const [dockerImage, setDockerImage] = useState("")

  const handleBlueprintChange = (id: string) => {
    setBlueprintId(id)
    const next = blueprintsQuery.data?.blueprints.find((b) => b.id === id)
    if (next === undefined) {
      setVariables({})
      setDockerImage("")
      return
    }
    const defaults: Record<string, string> = {}
    for (const variable of next.variables) {
      defaults[variable.key] = variable.default
    }
    setVariables(defaults)
    const firstImage = Object.values(next.dockerImages)[0]
    setDockerImage(firstImage ?? "")
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setFieldErrors([])

    if (blueprintId === "" || nodeId === "" || dockerImage === "") {
      setErrorMessage("Pick a blueprint, node, and image first.")
      return
    }

    const body: CreateServerRequest = {
      name,
      blueprintId,
      nodeId,
      dockerImage,
      memoryLimitMb,
      cpuLimitPercent,
      diskLimitMb,
      variables,
    }

    try {
      const result = await createServer.mutateAsync(body)
      await navigate({ to: "/servers/$id", params: { id: result.server.id } })
    } catch (err) {
      if (err instanceof ApiFetchError) {
        const fields = err.body.error.fields
        if (fields !== undefined && fields.length > 0) {
          setFieldErrors(
            fields.map(
              (f) =>
                `${f.path}: ${t(f.code, {
                  ns: "validation",
                  defaultValue: f.code,
                  ...(f.params ?? {}),
                })}`
            )
          )
        } else {
          setErrorMessage(translateApiError(t, err.body.error))
        }
      } else if (err instanceof Error) {
        setErrorMessage(err.message)
      }
    }
  }

  return (
    <div className="bg-background text-foreground flex min-h-svh flex-col">
      <header className="border-border flex items-center justify-between border-b px-6 py-4">
        <h1 className="text-base font-semibold">Provision a server</h1>
        <Link to="/dashboard">
          <Button variant="outline" size="sm">
            Cancel
          </Button>
        </Link>
      </header>
      <main className="mx-auto w-full max-w-2xl p-6">
        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <Field label="Name">
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border-border bg-background h-8 rounded-md border px-2 text-sm"
            />
          </Field>
          <Field label="Blueprint">
            <select
              value={blueprintId}
              onChange={(e) => handleBlueprintChange(e.target.value)}
              required
              className="border-border bg-background h-8 rounded-md border px-2 text-sm"
            >
              <option value="">Select a blueprint…</option>
              {blueprintsQuery.data?.blueprints.map((bp) => (
                <option key={bp.id} value={bp.id}>
                  {typeof bp.name === "string" ? bp.name : `[${bp.name.key}]`}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Docker image">
            <select
              value={dockerImage}
              onChange={(e) => setDockerImage(e.target.value)}
              required
              disabled={dockerImageOptions.length === 0}
              className="border-border bg-background h-8 rounded-md border px-2 text-sm"
            >
              <option value="">Select an image…</option>
              {dockerImageOptions.map(([label, image]) => (
                <option key={label} value={image}>
                  {label} ({image})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Node">
            <select
              value={nodeId}
              onChange={(e) => setNodeId(e.target.value)}
              required
              className="border-border bg-background h-8 rounded-md border px-2 text-sm"
            >
              <option value="">Select a node…</option>
              {nodesQuery.data?.nodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.name} ({node.fqdn})
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Memory (MB)">
              <input
                type="number"
                min={1}
                value={memoryLimitMb}
                onChange={(e) => setMemoryLimitMb(Number(e.target.value))}
                required
                className="border-border bg-background h-8 rounded-md border px-2 text-sm"
              />
            </Field>
            <Field label="CPU (%)">
              <input
                type="number"
                min={1}
                value={cpuLimitPercent}
                onChange={(e) => setCpuLimitPercent(Number(e.target.value))}
                required
                className="border-border bg-background h-8 rounded-md border px-2 text-sm"
              />
            </Field>
            <Field label="Disk (MB)">
              <input
                type="number"
                min={1}
                value={diskLimitMb}
                onChange={(e) => setDiskLimitMb(Number(e.target.value))}
                required
                className="border-border bg-background h-8 rounded-md border px-2 text-sm"
              />
            </Field>
          </div>
          {blueprint !== null && blueprint.variables.length > 0 ? (
            <section className="border-border bg-card mt-2 flex flex-col gap-2 rounded-md border p-3">
              <h2 className="text-xs font-medium">Blueprint variables</h2>
              {blueprint.variables.map((variable) => (
                <Field key={variable.key} label={variable.key}>
                  <input
                    value={variables[variable.key] ?? variable.default}
                    onChange={(e) =>
                      setVariables({
                        ...variables,
                        [variable.key]: e.target.value,
                      })
                    }
                    disabled={!variable.userEditable}
                    className="border-border bg-background h-8 rounded-md border px-2 text-sm"
                  />
                </Field>
              ))}
            </section>
          ) : null}
          {fieldErrors.length > 0 ? (
            <div
              className="border-destructive bg-destructive/10 text-destructive rounded border px-3 py-2 text-xs"
              role="alert"
            >
              <ul className="list-disc space-y-0.5 pl-4">
                {fieldErrors.map((message, index) => (
                  <li key={index}>{message}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {errorMessage !== null ? (
            <p className="text-destructive text-xs" role="alert">
              {errorMessage}
            </p>
          ) : null}
          <Button
            type="submit"
            disabled={createServer.isPending}
            className="mt-2"
          >
            {createServer.isPending ? "Provisioning…" : "Provision server"}
          </Button>
        </form>
      </main>
    </div>
  )
}

const Field = ({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) => (
  <label className="flex flex-col gap-1 text-xs">
    <span>{label}</span>
    {children}
  </label>
)

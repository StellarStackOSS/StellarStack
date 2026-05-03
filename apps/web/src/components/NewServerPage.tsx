import { useMemo, useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { ResourceStepper } from "@/components/ResourceStepper"

import { ApiFetchError } from "@/lib/ApiFetch"
import { translateApiError } from "@/lib/TranslateError"
import { useAllocations } from "@/hooks/useAllocations"
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
  const [allocationId, setAllocationId] = useState("")
  const [name, setName] = useState("")
  const [memoryLimitMb, setMemoryLimitMb] = useState(1024)
  const [cpuLimitPercent, setCpuLimitPercent] = useState(100)
  const [diskLimitMb, setDiskLimitMb] = useState(5_000)
  const [variables, setVariables] = useState<Record<string, string>>({})
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<string[]>([])

  const selectedNode = useMemo(
    () => nodesQuery.data?.nodes.find((n) => n.id === nodeId) ?? null,
    [nodesQuery.data, nodeId]
  )

  const allocationsQuery = useAllocations(nodeId !== "" ? nodeId : null)
  const freeAllocations = useMemo(
    () => (allocationsQuery.data?.allocations ?? []).filter((a) => a.serverId === null),
    [allocationsQuery.data]
  )

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

  const handleNodeChange = (id: string) => {
    setNodeId(id)
    setAllocationId("")
    const node = nodesQuery.data?.nodes.find((n) => n.id === id)
    if (node !== undefined) {
      setMemoryLimitMb(Math.min(memoryLimitMb, node.memoryTotalMb))
      setDiskLimitMb(Math.min(diskLimitMb, node.diskTotalMb))
    }
  }

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
      setErrorMessage(t("new_server.error.pick_blueprint_node_image"))
      return
    }

    const body: CreateServerRequest = {
      name,
      blueprintId,
      nodeId,
      ...(allocationId !== "" ? { allocationId } : {}),
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
      } else {
        setErrorMessage(t("internal.unexpected", { ns: "errors" }))
      }
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold">{t("new_server.title")}</h1>
        </div>
        <Link to="/dashboard">
          <Button variant="outline" size="sm">
            {t("new_server.cancel")}
          </Button>
        </Link>
      </header>
      <main>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <Field label={t("new_server.field.name")}>
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label={t("new_server.field.blueprint")}>
            <Select
              value={blueprintId}
              onValueChange={(v) => handleBlueprintChange(v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("new_server.field.blueprint_placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {blueprintsQuery.data?.blueprints.map((bp) => (
                  <SelectItem key={bp.id} value={bp.id}>
                    {typeof bp.name === "string" ? bp.name : `[${bp.name.key}]`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("new_server.field.docker_image")}>
            <Select
              value={dockerImage}
              onValueChange={(v) => setDockerImage(v)}
              disabled={dockerImageOptions.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("new_server.field.docker_image_placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {dockerImageOptions.map(([label, image]) => (
                  <SelectItem key={label} value={image}>
                    {label} ({image})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("new_server.field.node")}>
            <Select
              value={nodeId}
              onValueChange={handleNodeChange}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("new_server.field.node_placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {nodesQuery.data?.nodes.map((node) => (
                  <SelectItem key={node.id} value={node.id}>
                    {node.name} ({node.fqdn})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("new_server.field.allocation")}>
            <Select
              value={allocationId}
              onValueChange={setAllocationId}
              disabled={nodeId === "" || allocationsQuery.isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder={
                  nodeId === ""
                    ? t("new_server.field.allocation_pick_node_first")
                    : allocationsQuery.isLoading
                      ? t("new_server.field.allocation_loading")
                      : t("new_server.field.allocation_auto")
                } />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{t("new_server.field.allocation_auto")}</SelectItem>
                {freeAllocations.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.ip}:{a.port}{a.alias ? ` (${a.alias})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <ResourceStepper
            label={t("new_server.field.memory_mb")}
            value={memoryLimitMb}
            min={128}
            max={selectedNode?.memoryTotalMb ?? 65536}
            step={128}
            unit="MB"
            onChange={setMemoryLimitMb}
            disabled={selectedNode === null}
          />
          <ResourceStepper
            label={t("new_server.field.cpu_percent")}
            value={cpuLimitPercent}
            min={1}
            max={10000}
            step={1}
            unit="%"
            onChange={setCpuLimitPercent}
            disabled={selectedNode === null}
          />
          <ResourceStepper
            label={t("new_server.field.disk_mb")}
            value={diskLimitMb}
            min={512}
            max={selectedNode?.diskTotalMb ?? 1_000_000}
            step={512}
            unit="MB"
            onChange={setDiskLimitMb}
            disabled={selectedNode === null}
          />
          {blueprint !== null && blueprint.variables.length > 0 ? (
            <section className="border-border bg-card mt-2 flex flex-col gap-2 rounded-md border p-3">
              <h2 className="text-xs font-medium">{t("new_server.blueprint_variables")}</h2>
              {blueprint.variables.map((variable) => (
                <Field key={variable.key} label={variable.key}>
                  <Input
                    value={variables[variable.key] ?? variable.default}
                    onChange={(e) =>
                      setVariables({
                        ...variables,
                        [variable.key]: e.target.value,
                      })
                    }
                    disabled={!variable.userEditable}
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
            {createServer.isPending ? t("new_server.submitting") : t("new_server.submit")}
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
  <div className="flex flex-col gap-1">
    <Label className="text-xs">{label}</Label>
    {children}
  </div>
)


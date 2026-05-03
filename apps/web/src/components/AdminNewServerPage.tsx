import { useMemo, useState } from "react"
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
import { useAdminCreateServer } from "@/hooks/useAdminServers"
import { useBlueprints } from "@/hooks/useBlueprints"
import { useNodes } from "@/hooks/useNodes"
import { UserCombobox } from "@/components/UserCombobox"

const varName = (name: string | { key: string }, key: string): string =>
  typeof name === "string" ? name : key

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label className="text-xs">{label}</Label>
    {children}
  </div>
)


export const AdminNewServerPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const { data: blueprintsData } = useBlueprints()
  const { data: nodesData } = useNodes()
  const create = useAdminCreateServer()

  const [name, setName] = useState("")
  const [ownerId, setOwnerId] = useState("")
  const [blueprintId, setBlueprintId] = useState("")
  const [dockerImage, setDockerImage] = useState("")
  const [nodeId, setNodeId] = useState("")
  const [memory, setMemory] = useState(1024)
  const [cpu, setCpu] = useState(100)
  const [disk, setDisk] = useState(5000)
  const [variables, setVariables] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  const blueprints = blueprintsData?.blueprints ?? []
  const nodes = nodesData?.nodes ?? []

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === nodeId) ?? null,
    [nodes, nodeId]
  )

  const selectedBlueprint = useMemo(
    () => blueprints.find((b) => b.id === blueprintId) ?? null,
    [blueprints, blueprintId]
  )
  const imageOptions = useMemo(
    () => Object.entries((selectedBlueprint?.dockerImages as Record<string, string>) ?? {}),
    [selectedBlueprint]
  )
  const blueprintVars = useMemo(
    () =>
      (selectedBlueprint?.variables as
        | Array<{ key: string; name: string; default: string; userEditable: boolean }>
        | undefined) ?? [],
    [selectedBlueprint]
  )

  const handleNodeChange = (id: string) => {
    setNodeId(id)
    const node = nodes.find((n) => n.id === id)
    if (node !== undefined) {
      setMemory(Math.min(memory, node.memoryTotalMb))
      setDisk(Math.min(disk, node.diskTotalMb))
    }
  }

  const handleBlueprintChange = (id: string) => {
    setBlueprintId(id)
    setDockerImage("")
    const bp = blueprints.find((b) => b.id === id)
    if (bp === undefined) { setVariables({}); return }
    const defaults: Record<string, string> = {}
    for (const v of bp.variables as Array<{ key: string; default: string }>) {
      defaults[v.key] = v.default
    }
    setVariables(defaults)
    const firstImage = Object.values(bp.dockerImages as Record<string, string>)[0]
    if (firstImage !== undefined) setDockerImage(firstImage)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    try {
      const result = await create.mutateAsync({
        name,
        ownerId,
        blueprintId,
        dockerImage,
        nodeId,
        memoryLimitMb: memory,
        cpuLimitPercent: cpu,
        diskLimitMb: disk,
        variables,
      })
      void navigate({
        to: "/admin/servers/$serverId",
        params: { serverId: result.server.id },
        search: { tab: "overview" },
      })
    } catch (err) {
      setError(
        err instanceof ApiFetchError
          ? translateApiError(t, err.body.error)
          : t("internal.unexpected", { ns: "errors" })
      )
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-base font-semibold">{t("admin_servers.create_title")}</h1>
          <p className="text-muted-foreground text-xs">{t("admin_servers.create_description")}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void navigate({ to: "/admin/servers" as string })}
        >
          {t("actions.cancel")}
        </Button>
      </header>

      <form className="flex flex-col gap-4" onSubmit={(e) => void handleSubmit(e)}>
        <Card>
          <CardHeader>
            <CardTitle>{t("admin_servers.section.general")}</CardTitle>
          </CardHeader>
          <CardInner className="p-3 flex flex-col gap-3">
            <Field label={t("admin_servers.field.name")}>
              <Input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={64}
              />
            </Field>
            <Field label={t("admin_servers.field.owner")}>
              <UserCombobox value={ownerId} onChange={setOwnerId} />
            </Field>
            <Field label={t("admin_servers.field.node")}>
              <Select value={nodeId} onValueChange={handleNodeChange}>
                <SelectTrigger>
                  <SelectValue placeholder={t("admin_servers.field.node_placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  {nodes.map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.name} ({n.fqdn})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            </CardInner>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("admin_servers.section.build")}</CardTitle>
            <CardDescription>{t("admin_servers.section.build_description")}</CardDescription>
          </CardHeader>
          <CardInner className="p-3 flex flex-col gap-3">
            <Field label={t("admin_servers.field.blueprint")}>
              <Select value={blueprintId} onValueChange={handleBlueprintChange}>
                <SelectTrigger>
                  <SelectValue placeholder={t("admin_servers.field.blueprint_placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  {blueprints.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {typeof b.name === "string" ? b.name : `[${(b.name as { key: string }).key}]`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("admin_servers.field.docker_image")}>
              <Select
                value={dockerImage}
                onValueChange={setDockerImage}
                disabled={imageOptions.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("admin_servers.field.docker_image_placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  {imageOptions.map(([label, image]) => (
                    <SelectItem key={image} value={image}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            </CardInner>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("admin_servers.section.resources")}</CardTitle>
          </CardHeader>
          <CardInner className="p-3 flex flex-col gap-4">
            {selectedNode === null && (
              <p className="text-muted-foreground text-xs">{t("admin_servers.resources_pick_node_first")}</p>
            )}
            <ResourceStepper
              label={t("admin_servers.field.memory")}
              value={memory}
              min={128}
              max={selectedNode?.memoryTotalMb ?? 65536}
              step={128}
              unit="MB"
              onChange={setMemory}
              disabled={selectedNode === null}
            />
            <ResourceStepper
              label={t("admin_servers.field.cpu")}
              value={cpu}
              min={1}
              max={10000}
              step={1}
              unit="%"
              onChange={setCpu}
              disabled={selectedNode === null}
            />
            <ResourceStepper
              label={t("admin_servers.field.disk")}
              value={disk}
              min={512}
              max={selectedNode?.diskTotalMb ?? 1_000_000}
              step={512}
              unit="MB"
              onChange={setDisk}
              disabled={selectedNode === null}
            />
            </CardInner>
        </Card>

        {blueprintVars.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{t("admin_servers.section.variables")}</CardTitle>
            </CardHeader>
            <CardInner className="p-3 flex flex-col gap-3">
              {blueprintVars.map((v) => (
                <Field key={v.key} label={`${varName(v.name, v.key)} (${v.key})`}>
                  <Input
                    value={variables[v.key] ?? v.default}
                    onChange={(e) =>
                      setVariables((prev) => ({ ...prev, [v.key]: e.target.value }))
                    }
                    disabled={!v.userEditable}
                  />
                </Field>
              ))}
              </CardInner>
          </Card>
        )}

        {error !== null && (
          <p className="text-destructive text-xs" role="alert">{error}</p>
        )}

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={create.isPending || !name || !ownerId || !blueprintId || !dockerImage || !nodeId}
          >
            {create.isPending ? t("admin_servers.creating") : t("admin_servers.create_submit")}
          </Button>
        </div>
      </form>
    </div>
  )
}

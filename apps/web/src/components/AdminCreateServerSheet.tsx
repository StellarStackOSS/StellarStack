import { useMemo, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet"

import { ApiFetchError } from "@/lib/ApiFetch"
import { translateApiError } from "@/lib/TranslateError"
import { useAdminCreateServer } from "@/hooks/useAdminServers"
import { useAdminUsers } from "@/hooks/useAdminUsers"
import { useBlueprints } from "@/hooks/useBlueprints"
import { useNodes } from "@/hooks/useNodes"

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label className="text-xs">{label}</Label>
    {children}
  </div>
)

export const AdminCreateServerSheet = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const { data: usersData } = useAdminUsers()
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

  const users = usersData?.users ?? []
  const blueprints = blueprintsData?.blueprints ?? []
  const nodes = nodesData?.nodes ?? []

  const selectedBlueprint = useMemo(
    () => blueprints.find((b) => b.id === blueprintId) ?? null,
    [blueprints, blueprintId]
  )
  const imageOptions = useMemo(
    () => Object.entries(selectedBlueprint?.dockerImages as Record<string, string> ?? {}),
    [selectedBlueprint]
  )
  const blueprintVars = useMemo(
    () => (selectedBlueprint?.variables as Array<{ key: string; name: string; default: string; userEditable: boolean }> | undefined) ?? [],
    [selectedBlueprint]
  )

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

  const reset = () => {
    setName("")
    setOwnerId("")
    setBlueprintId("")
    setDockerImage("")
    setNodeId("")
    setMemory(1024)
    setCpu(100)
    setDisk(5000)
    setVariables({})
    setError(null)
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
      setOpen(false)
      reset()
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
    <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
      <SheetTrigger asChild>
        <Button size="sm">{t("admin_servers.create")}</Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("admin_servers.create_title")}</SheetTitle>
          <SheetDescription>{t("admin_servers.create_description")}</SheetDescription>
        </SheetHeader>
        <form className="flex flex-col gap-4 px-6 pb-8" onSubmit={(e) => void handleSubmit(e)}>
          <Field label={t("admin_servers.field.name")}>
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={64}
            />
          </Field>

          <Field label={t("admin_servers.field.owner")}>
            <Select value={ownerId} onValueChange={setOwnerId}>
              <SelectTrigger>
                <SelectValue placeholder={t("admin_servers.field.owner_placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} — {u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label={t("admin_servers.field.node")}>
            <Select value={nodeId} onValueChange={setNodeId}>
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

          <div className="grid grid-cols-3 gap-3">
            <Field label={t("admin_servers.field.memory")}>
              <Input
                type="number"
                min={1}
                value={memory}
                onChange={(e) => setMemory(Number(e.target.value))}
                required
              />
            </Field>
            <Field label={t("admin_servers.field.cpu")}>
              <Input
                type="number"
                min={1}
                value={cpu}
                onChange={(e) => setCpu(Number(e.target.value))}
                required
              />
            </Field>
            <Field label={t("admin_servers.field.disk")}>
              <Input
                type="number"
                min={1}
                value={disk}
                onChange={(e) => setDisk(Number(e.target.value))}
                required
              />
            </Field>
          </div>

          {blueprintVars.length > 0 && (
            <div className="flex flex-col gap-3 rounded-md border p-3">
              <p className="text-xs font-medium">{t("new_server.blueprint_variables")}</p>
              {blueprintVars.map((v) => (
                <Field key={v.key} label={`${v.name} (${v.key})`}>
                  <Input
                    value={variables[v.key] ?? v.default}
                    onChange={(e) => setVariables((prev) => ({ ...prev, [v.key]: e.target.value }))}
                    disabled={!v.userEditable}
                  />
                </Field>
              ))}
            </div>
          )}

          {error !== null && (
            <p className="text-destructive text-xs" role="alert">{error}</p>
          )}

          <Button
            type="submit"
            disabled={create.isPending || !name || !ownerId || !blueprintId || !dockerImage || !nodeId}
          >
            {create.isPending ? t("admin_servers.creating") : t("admin_servers.create_submit")}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}

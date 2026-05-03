import { useState } from "react"
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
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet"

import {
  useAdminAddAllocation,
  useAdminReinstallServer,
  useAdminRemoveAllocation,
  useAdminServerDetail,
  useAdminSetPrimaryAllocation,
  useAdminUpdateServer,
  useAdminUpdateVariables,
} from "@/hooks/useAdminServers"
import { useAllocations } from "@/hooks/useAllocations"
import { useBlueprints } from "@/hooks/useBlueprints"
import type { AdminServerRow } from "@/hooks/useAdminServers.types"

type Props = { server: AdminServerRow }

const ResourcesSection = ({ server }: Props) => {
  const { t } = useTranslation()
  const update = useAdminUpdateServer(server.id)
  const [memory, setMemory] = useState(String(server.memoryLimitMb))
  const [cpu, setCpu] = useState(String(server.cpuLimitPercent))
  const [disk, setDisk] = useState(String(server.diskLimitMb))

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("admin_servers.section.resources")}</CardTitle>
      </CardHeader>
      <CardInner className="p-3 flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>{t("admin_servers.field.memory")}</Label>
            <Input type="number" value={memory} onChange={(e) => setMemory(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("admin_servers.field.cpu")}</Label>
            <Input type="number" value={cpu} onChange={(e) => setCpu(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("admin_servers.field.disk")}</Label>
            <Input type="number" value={disk} onChange={(e) => setDisk(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={update.isPending}
            onClick={() =>
              update.mutate({
                memoryLimitMb: Number(memory),
                cpuLimitPercent: Number(cpu),
                diskLimitMb: Number(disk),
              })
            }
          >
            {update.isPending ? t("settings.saving") : t("admin_servers.save_resources")}
          </Button>
        </div>
        </CardInner>
    </Card>
  )
}

const BuildSection = ({ server }: Props) => {
  const { t } = useTranslation()
  const { data: blueprintsData } = useBlueprints()
  const update = useAdminUpdateServer(server.id)

  const [blueprintId, setBlueprintId] = useState(server.blueprintId)
  const [dockerImage, setDockerImage] = useState(server.dockerImage)

  const blueprints = blueprintsData?.blueprints ?? []
  const selectedBlueprint = blueprints.find((b) => b.id === blueprintId)
  const imageOptions = selectedBlueprint
    ? Object.entries(selectedBlueprint.dockerImages as Record<string, string>)
    : []

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("admin_servers.section.build")}</CardTitle>
      </CardHeader>
      <CardInner className="p-3 flex flex-col gap-3">
        <div className="space-y-1.5">
          <Label>{t("admin_servers.field.blueprint")}</Label>
          <Select
            value={blueprintId}
            onValueChange={(v) => {
              setBlueprintId(v)
              setDockerImage("")
            }}
          >
            <SelectTrigger>
              <SelectValue />
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
          <Label>{t("admin_servers.field.docker_image")}</Label>
          <Select
            value={dockerImage}
            onValueChange={setDockerImage}
            disabled={imageOptions.length === 0}
          >
            <SelectTrigger>
              <SelectValue />
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
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={update.isPending || !blueprintId || !dockerImage}
            onClick={() => update.mutate({ blueprintId, dockerImage })}
          >
            {update.isPending ? t("settings.saving") : t("admin_servers.save_build")}
          </Button>
        </div>
        </CardInner>
    </Card>
  )
}

const VariablesSection = ({ server }: Props) => {
  const { t } = useTranslation()
  const { data, isLoading } = useAdminServerDetail(server.id)
  const saveVars = useAdminUpdateVariables(server.id)

  const [vars, setVars] = useState<Record<string, string>>({})
  const [initialised, setInitialised] = useState(false)

  if (!initialised && data !== undefined) {
    const initial: Record<string, string> = {}
    for (const row of data.variables) {
      initial[row.variableKey] = row.value
    }
    setVars(initial)
    setInitialised(true)
  }

  if (isLoading) {
    return (
      <Card>
        <CardInner className="p-3">
          <p className="py-4 text-xs text-muted-foreground">
            {t("admin_servers.loading_detail")}
          </p>
        </CardInner>
      </Card>
    )
  }

  const blueprintVars = data?.blueprint?.variables ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("admin_servers.section.variables")}</CardTitle>
        <CardDescription>
          {blueprintVars.length === 0
            ? "No variables defined by this blueprint."
            : `${blueprintVars.length} variable${blueprintVars.length !== 1 ? "s" : ""}`}
        </CardDescription>
      </CardHeader>
      <CardInner className="p-3 flex flex-col gap-3">
        {blueprintVars.map((v) => (
          <div key={v.key} className="space-y-1.5">
            <Label>
              {typeof v.name === "string" ? v.name : v.key}{" "}
              <span className="text-muted-foreground font-mono text-xs">({v.key})</span>
            </Label>
            <Input
              value={vars[v.key] ?? v.default}
              onChange={(e) => setVars((prev) => ({ ...prev, [v.key]: e.target.value }))}
              placeholder={v.default}
            />
          </div>
        ))}
        {blueprintVars.length > 0 && (
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={saveVars.isPending}
              onClick={() => saveVars.mutate(vars)}
            >
              {saveVars.isPending ? t("settings.saving") : t("admin_servers.save_variables")}
            </Button>
          </div>
        )}
        </CardInner>
    </Card>
  )
}

const AllocationsSection = ({ server }: Props) => {
  const { t } = useTranslation()
  const { data } = useAdminServerDetail(server.id)
  const { data: nodeAllocs } = useAllocations(server.nodeId)
  const addAlloc = useAdminAddAllocation(server.id)
  const removeAlloc = useAdminRemoveAllocation(server.id)
  const setPrimary = useAdminSetPrimaryAllocation(server.id)

  const [selectedFree, setSelectedFree] = useState("")

  const bound = data?.allocations ?? []
  const primaryId = data?.server.primaryAllocationId ?? null
  const freeAllocations = (nodeAllocs?.allocations ?? []).filter(
    (a) => a.serverId === null
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("admin_servers.section.allocations")}</CardTitle>
      </CardHeader>
      <CardInner className="p-3 flex flex-col gap-3">
        <ul className="flex flex-col gap-1">
          {bound.map((a) => (
            <li
              key={a.id}
              className="border-border flex items-center justify-between rounded border px-2 py-1.5 text-xs"
            >
              <div className="flex items-center gap-2">
                <code className="font-mono">
                  {a.ip}:{a.port}
                </code>
                {a.id === primaryId && (
                  <span className="bg-chart-1/15 text-chart-1 rounded-full px-1.5 py-0.5 text-[0.6rem] font-medium">
                    {t("admin_servers.primary_badge")}
                  </span>
                )}
              </div>
              <div className="flex gap-1.5">
                {a.id !== primaryId && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs"
                    disabled={setPrimary.isPending}
                    onClick={() => setPrimary.mutate(a.id)}
                  >
                    {t("admin_servers.set_primary")}
                  </Button>
                )}
                {a.id !== primaryId && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                    disabled={removeAlloc.isPending}
                    onClick={() => removeAlloc.mutate(a.id)}
                  >
                    {t("admin_servers.unbind")}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>

        {freeAllocations.length > 0 && (
          <div className="flex gap-2">
            <Select value={selectedFree} onValueChange={setSelectedFree}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder={t("admin_servers.bind_allocation")} />
              </SelectTrigger>
              <SelectContent>
                {freeAllocations.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.ip}:{a.port}
                    {a.alias ? ` (${a.alias})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={!selectedFree || addAlloc.isPending}
              onClick={() => {
                addAlloc.mutate(selectedFree, { onSuccess: () => setSelectedFree("") })
              }}
            >
              {t("admin_servers.bind_allocation")}
            </Button>
          </div>
        )}
        {freeAllocations.length === 0 && bound.length > 0 && (
          <p className="text-muted-foreground text-xs">{t("admin_servers.no_free_allocations")}</p>
        )}
        </CardInner>
    </Card>
  )
}

const ReinstallSection = ({ server }: Props) => {
  const { t } = useTranslation()
  const reinstall = useAdminReinstallServer(server.id)
  const [keepFiles, setKeepFiles] = useState(false)
  const [snapshotFirst, setSnapshotFirst] = useState(true)
  const [confirming, setConfirming] = useState(false)

  const handleClick = () => {
    if (!confirming) { setConfirming(true); return }
    reinstall.mutate(
      { keepFiles, snapshotFirst },
      { onSuccess: () => setConfirming(false) }
    )
  }

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive">{t("admin_servers.section.danger")}</CardTitle>
      </CardHeader>
      <CardInner className="p-3 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="keep-files"
            checked={keepFiles}
            onCheckedChange={(v) => setKeepFiles(v === true)}
          />
          <Label htmlFor="keep-files">{t("admin_servers.reinstall_keep_files")}</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="snapshot-first"
            checked={snapshotFirst}
            onCheckedChange={(v) => setSnapshotFirst(v === true)}
          />
          <Label htmlFor="snapshot-first">{t("admin_servers.reinstall_snapshot")}</Label>
        </div>
        <div className="flex justify-end">
          <Button
            size="sm"
            variant={confirming ? "destructive" : "outline"}
            disabled={reinstall.isPending}
            onClick={handleClick}
            onBlur={() => setConfirming(false)}
          >
            {reinstall.isPending
              ? t("admin_servers.reinstalling")
              : confirming
                ? t("actions.confirm")
                : t("admin_servers.reinstall")}
          </Button>
        </div>
        </CardInner>
    </Card>
  )
}

export const AdminServerEditSheet = ({ server }: Props) => {
  const { t } = useTranslation()

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          {t("admin_servers.edit")}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("admin_servers.edit_title")}</SheetTitle>
          <SheetDescription>{server.name}</SheetDescription>
        </SheetHeader>
        <SheetBody>
          <ResourcesSection server={server} />
          <BuildSection server={server} />
          <VariablesSection server={server} />
          <AllocationsSection server={server} />
          <ReinstallSection server={server} />
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}

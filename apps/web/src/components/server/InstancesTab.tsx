import { useMemo, useState } from "react"
import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardInner,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import { ResourceStepper } from "@/components/ResourceStepper"
import { useServerLayout } from "@/components/ServerLayoutContext"
import { useAllocations } from "@/hooks/useAllocations"
import { useBlueprints } from "@/hooks/useBlueprints"
import {
  useCreateServerInstance,
  useServerInstances,
  useServerPool,
} from "@/hooks/useServerInstances"
import { ApiFetchError } from "@/lib/ApiFetch"
import { translateApiError } from "@/lib/TranslateError"

export const InstancesTab = () => {
  const { t } = useTranslation()
  const { server } = useServerLayout()
  const isChild = server.parentId !== null

  const instancesQuery = useServerInstances(server.id)
  const poolQuery = useServerPool(server.id)
  const [open, setOpen] = useState(false)

  const instances = instancesQuery.data?.instances ?? []
  const pool = poolQuery.data ?? null

  if (isChild) {
    return (
      <div className="flex flex-col gap-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>{t("instances.title")}</CardTitle>
            <CardDescription>
              {t("instances.is_child_description")}
            </CardDescription>
          </CardHeader>
          <CardInner className="p-3">
            <Link to="/servers/$id" params={{ id: server.parentId ?? "" }}>
              <Button size="sm" variant="outline">
                {t("instances.go_to_parent")}
              </Button>
            </Link>
          </CardInner>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>{t("instances.title")}</CardTitle>
              <CardDescription>
                {t("instances.description")}
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setOpen(true)}>
              {t("instances.create")}
            </Button>
          </div>
        </CardHeader>
        <CardInner className="p-3">
          <PoolBars pool={pool} />
        </CardInner>
      </Card>

      <Card className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden rounded-xl p-0">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-medium">
            {t("instances.list_heading")}
          </span>
          <span className="text-muted-foreground text-xs">
            {instances.length}
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs h-9">
                  {t("instances.col.name")}
                </TableHead>
                <TableHead className="text-xs h-9">
                  {t("instances.col.memory")}
                </TableHead>
                <TableHead className="text-xs h-9">
                  {t("instances.col.cpu")}
                </TableHead>
                <TableHead className="text-xs h-9">
                  {t("instances.col.disk")}
                </TableHead>
                <TableHead className="text-xs h-9">
                  {t("instances.col.status")}
                </TableHead>
                <TableHead className="text-xs h-9" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {instancesQuery.isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-muted-foreground text-xs"
                  >
                    {t("instances.loading")}
                  </TableCell>
                </TableRow>
              ) : instances.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-muted-foreground text-xs"
                  >
                    {t("instances.empty")}
                  </TableCell>
                </TableRow>
              ) : (
                instances.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-xs">{row.name}</TableCell>
                    <TableCell className="text-xs">
                      {row.memoryLimitMb} MB
                    </TableCell>
                    <TableCell className="text-xs">
                      {row.cpuLimitPercent}%
                    </TableCell>
                    <TableCell className="text-xs">
                      {row.diskLimitMb} MB
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {row.status}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        to="/servers/$id"
                        params={{ id: row.id }}
                      >
                        <Button size="xs" variant="outline">
                          {t("instances.open")}
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {pool !== null ? (
        <CreateInstanceDialog
          open={open}
          onOpenChange={setOpen}
          parentId={server.id}
          parentNodeId={server.nodeId}
          pool={pool}
        />
      ) : null}
    </div>
  )
}

const PoolBars = ({
  pool,
}: {
  pool: {
    memoryTotalMb: number
    memoryUsedMb: number
    memoryFreeMb: number
    diskTotalMb: number
    diskUsedMb: number
    diskFreeMb: number
    cpuTotalPercent: number
    cpuUsedPercent: number
    cpuFreePercent: number
  } | null
}) => {
  const { t } = useTranslation()
  if (pool === null) {
    return (
      <p className="text-muted-foreground text-xs">{t("instances.loading")}</p>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      <PoolBar
        label={t("instances.pool.memory")}
        used={pool.memoryUsedMb}
        free={pool.memoryFreeMb}
        total={pool.memoryTotalMb}
        unit="MB"
      />
      <PoolBar
        label={t("instances.pool.cpu")}
        used={pool.cpuUsedPercent}
        free={pool.cpuFreePercent}
        total={pool.cpuTotalPercent}
        unit="%"
      />
      <PoolBar
        label={t("instances.pool.disk")}
        used={pool.diskUsedMb}
        free={pool.diskFreeMb}
        total={pool.diskTotalMb}
        unit="MB"
      />
    </div>
  )
}

const PoolBar = ({
  label,
  used,
  free,
  total,
  unit,
}: {
  label: string
  used: number
  free: number
  total: number
  unit: string
}) => {
  const pct = total === 0 ? 0 : Math.min(100, (used / total) * 100)
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-[0.7rem]">
          {used} {unit} allocated
          <span className="text-muted-foreground"> · {free} free of {total}</span>
        </span>
      </div>
      <div className="bg-muted h-1.5 w-full overflow-hidden rounded">
        <div className="bg-primary h-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

const CreateInstanceDialog = ({
  open,
  onOpenChange,
  parentId,
  parentNodeId,
  pool,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  parentId: string
  parentNodeId: string
  pool: {
    memoryFreeMb: number
    diskFreeMb: number
    cpuFreePercent: number
  }
}) => {
  const { t } = useTranslation()
  const blueprintsQuery = useBlueprints()
  const allocationsQuery = useAllocations(parentNodeId)
  const create = useCreateServerInstance(parentId)

  const [name, setName] = useState("")
  const [blueprintId, setBlueprintId] = useState("")
  const [dockerImage, setDockerImage] = useState("")
  const [allocationId, setAllocationId] = useState("")
  const [memoryLimitMb, setMemoryLimitMb] = useState(
    Math.min(512, pool.memoryFreeMb)
  )
  const [cpuLimitPercent, setCpuLimitPercent] = useState(
    Math.min(25, pool.cpuFreePercent)
  )
  const [diskLimitMb, setDiskLimitMb] = useState(
    Math.min(1024, pool.diskFreeMb)
  )
  const [error, setError] = useState<string | null>(null)

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
  const freeAllocations = useMemo(
    () =>
      (allocationsQuery.data?.allocations ?? []).filter(
        (a) => a.serverId === null
      ),
    [allocationsQuery.data]
  )

  const handleBlueprintChange = (id: string) => {
    setBlueprintId(id)
    const next = blueprintsQuery.data?.blueprints.find((b) => b.id === id)
    if (next === undefined) {
      setDockerImage("")
      return
    }
    const firstImage = Object.values(next.dockerImages)[0]
    setDockerImage(firstImage ?? "")
  }

  const submit = async () => {
    setError(null)
    if (
      name === "" ||
      blueprintId === "" ||
      dockerImage === "" ||
      allocationId === ""
    ) {
      setError(t("instances.error.required_fields"))
      return
    }
    try {
      const variables: Record<string, string> = {}
      for (const v of blueprint?.variables ?? []) {
        variables[v.key] = v.default
      }
      await create.mutateAsync({
        name,
        blueprintId,
        dockerImage,
        primaryAllocationId: allocationId,
        memoryLimitMb,
        cpuLimitPercent,
        diskLimitMb,
        variables,
      })
      onOpenChange(false)
      setName("")
    } catch (err) {
      if (err instanceof ApiFetchError) {
        setError(translateApiError(t, err.body.error))
      } else {
        setError(t("internal.unexpected", { ns: "errors" }))
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("instances.create_title")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Field label={t("instances.field.name")}>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label={t("instances.field.blueprint")}>
            <Select value={blueprintId} onValueChange={handleBlueprintChange}>
              <SelectTrigger>
                <SelectValue
                  placeholder={t("instances.field.blueprint_placeholder")}
                />
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
          <Field label={t("instances.field.docker_image")}>
            <Select
              value={dockerImage}
              onValueChange={setDockerImage}
              disabled={dockerImageOptions.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t("instances.field.docker_image_placeholder")}
                />
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
          <Field label={t("instances.field.allocation")}>
            <Select value={allocationId} onValueChange={setAllocationId}>
              <SelectTrigger>
                <SelectValue
                  placeholder={t("instances.field.allocation_placeholder")}
                />
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
          </Field>
          <ResourceStepper
            label={t("instances.field.memory")}
            value={memoryLimitMb}
            min={64}
            max={Math.max(64, pool.memoryFreeMb)}
            step={64}
            unit="MB"
            onChange={setMemoryLimitMb}
          />
          <ResourceStepper
            label={t("instances.field.cpu")}
            value={cpuLimitPercent}
            min={1}
            max={Math.max(1, pool.cpuFreePercent)}
            step={1}
            unit="%"
            onChange={setCpuLimitPercent}
          />
          <ResourceStepper
            label={t("instances.field.disk")}
            value={diskLimitMb}
            min={128}
            max={Math.max(128, pool.diskFreeMb)}
            step={128}
            unit="MB"
            onChange={setDiskLimitMb}
          />
          {error !== null ? (
            <p className="text-destructive text-xs" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            {t("instances.cancel")}
          </Button>
          <Button
            size="sm"
            disabled={create.isPending}
            onClick={submit}
          >
            {create.isPending
              ? t("instances.creating")
              : t("instances.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

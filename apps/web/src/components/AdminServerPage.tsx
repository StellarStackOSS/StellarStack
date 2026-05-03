import { useState } from "react"
import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router"
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
import {
  useAdminAddAllocation,
  useAdminDeleteServer,
  useAdminReinstallServer,
  useAdminRemoveAllocation,
  useAdminServerDetail,
  useAdminServers,
  useAdminSetPrimaryAllocation,
  useAdminToggleSuspend,
  useAdminUpdateServer,
  useAdminUpdateVariables,
} from "@/hooks/useAdminServers"
import { useAllocations } from "@/hooks/useAllocations"
import { useBlueprints } from "@/hooks/useBlueprints"

type Tab = "overview" | "blueprint" | "allocations" | "settings"

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "blueprint", label: "Blueprint" },
  { id: "allocations", label: "Allocations" },
  { id: "settings", label: "Settings" },
]

const OverviewTab = ({ serverId }: { serverId: string }) => {
  const { t } = useTranslation()
  const { data: detail, isLoading } = useAdminServerDetail(serverId)
  const { data: serversData } = useAdminServers()
  const toggleSuspend = useAdminToggleSuspend()

  const server = serversData?.servers.find((s) => s.id === serverId)

  if (isLoading || server === undefined) {
    return <p className="text-muted-foreground text-xs">{t("admin_servers.loading_detail")}</p>
  }

  const allocs = detail?.allocations ?? []
  const primaryAlloc = allocs.find((a) => a.id === detail?.server.primaryAllocationId)

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("admin_servers.col.status")}</CardTitle>
        </CardHeader>
        <CardInner className="p-3 flex flex-col gap-3 text-sm">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="text-muted-foreground">Status</div>
            <div>{t(`lifecycle.${server.status}`)}</div>
            <div className="text-muted-foreground">Suspended</div>
            <div>{server.suspended ? "Yes" : "No"}</div>
            <div className="text-muted-foreground">Owner</div>
            <div>{server.ownerName ?? "—"} ({server.ownerEmail ?? "—"})</div>
            <div className="text-muted-foreground">Node</div>
            <div>{server.nodeName ?? "—"} ({server.nodeFqdn ?? "—"})</div>
            <div className="text-muted-foreground">Primary allocation</div>
            <div className="font-mono">
              {primaryAlloc ? `${primaryAlloc.ip}:${primaryAlloc.port}` : "—"}
            </div>
            <div className="text-muted-foreground">Created</div>
            <div>{new Date(server.createdAt).toLocaleString()}</div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              variant="secondary"
              disabled={toggleSuspend.isPending}
              onClick={() => toggleSuspend.mutate(serverId)}
            >
              {server.suspended ? t("admin_servers.unsuspend") : t("admin_servers.suspend")}
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link to="/servers/$id" params={{ id: serverId }}>
                {t("admin_servers.view")}
              </Link>
            </Button>
          </div>
          </CardInner>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin_servers.section.resources")}</CardTitle>
        </CardHeader>
        <CardInner className="p-3 grid grid-cols-3 gap-4 text-xs">
          <div>
            <p className="text-muted-foreground">{t("admin_servers.field.memory")}</p>
            <p className="font-medium">{server.memoryLimitMb} MB</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t("admin_servers.field.cpu")}</p>
            <p className="font-medium">{server.cpuLimitPercent}%</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t("admin_servers.field.disk")}</p>
            <p className="font-medium">{server.diskLimitMb} MB</p>
          </div>
          </CardInner>
      </Card>
    </div>
  )
}

const BlueprintTab = ({ serverId }: { serverId: string }) => {
  const { t } = useTranslation()
  const { data: detail, isLoading } = useAdminServerDetail(serverId)
  const { data: serversData } = useAdminServers()
  const { data: blueprintsData } = useBlueprints()
  const updateServer = useAdminUpdateServer(serverId)
  const saveVars = useAdminUpdateVariables(serverId)

  const server = serversData?.servers.find((s) => s.id === serverId)
  const blueprints = blueprintsData?.blueprints ?? []

  const [blueprintId, setBlueprintId] = useState<string | null>(null)
  const [dockerImage, setDockerImage] = useState<string | null>(null)
  const [vars, setVars] = useState<Record<string, string> | null>(null)

  if (isLoading || server === undefined) {
    return <p className="text-muted-foreground text-xs">{t("admin_servers.loading_detail")}</p>
  }

  const activeBlueprintId = blueprintId ?? server.blueprintId
  const activeDockerImage = dockerImage ?? server.dockerImage
  const selectedBlueprint = blueprints.find((b) => b.id === activeBlueprintId)
  const imageOptions = selectedBlueprint
    ? Object.entries(selectedBlueprint.dockerImages as Record<string, string>)
    : []
  const blueprintVars = detail?.blueprint?.variables ?? []
  const activeVars = vars ?? Object.fromEntries(
    (detail?.variables ?? []).map((v) => [v.variableKey, v.value])
  )

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("admin_servers.section.build")}</CardTitle>
          <CardDescription>
            {t("admin_servers.field.blueprint")} &amp; {t("admin_servers.field.docker_image")}
          </CardDescription>
        </CardHeader>
        <CardInner className="p-3 flex flex-col gap-3">
          <div className="space-y-1.5">
            <Label>{t("admin_servers.field.blueprint")}</Label>
            <Select
              value={activeBlueprintId}
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
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("admin_servers.field.docker_image")}</Label>
            <Select
              value={activeDockerImage}
              onValueChange={setDockerImage}
              disabled={imageOptions.length === 0}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {imageOptions.map(([label, image]) => (
                  <SelectItem key={image} value={image}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={updateServer.isPending || !activeDockerImage}
              onClick={() => updateServer.mutate({ blueprintId: activeBlueprintId, dockerImage: activeDockerImage })}
            >
              {updateServer.isPending ? t("settings.saving") : t("admin_servers.save_build")}
            </Button>
          </div>
          </CardInner>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin_servers.section.variables")}</CardTitle>
          <CardDescription>
            {blueprintVars.length === 0
              ? "No variables defined by this blueprint."
              : `${blueprintVars.length} variable${blueprintVars.length !== 1 ? "s" : ""}`}
          </CardDescription>
        </CardHeader>
        {blueprintVars.length > 0 && (
          <CardInner className="p-3 flex flex-col gap-3">
            {blueprintVars.map((v) => (
              <div key={v.key} className="space-y-1.5">
                <Label>
                  {typeof v.name === "string" ? v.name : v.key}{" "}
                  <span className="text-muted-foreground font-mono text-xs">({v.key})</span>
                </Label>
                <Input
                  value={activeVars[v.key] ?? v.default}
                  onChange={(e) => setVars((prev) => ({ ...(prev ?? activeVars), [v.key]: e.target.value }))}
                  placeholder={v.default}
                />
              </div>
            ))}
            <div className="flex justify-end">
              <Button
                size="sm"
                disabled={saveVars.isPending}
                onClick={() => saveVars.mutate(activeVars)}
              >
                {saveVars.isPending ? t("settings.saving") : t("admin_servers.save_variables")}
              </Button>
            </div>
            </CardInner>
        )}
      </Card>
    </div>
  )
}

const AllocationsTab = ({ serverId }: { serverId: string }) => {
  const { t } = useTranslation()
  const { data: detail } = useAdminServerDetail(serverId)
  const { data: serversData } = useAdminServers()
  const server = serversData?.servers.find((s) => s.id === serverId)
  const { data: nodeAllocs } = useAllocations(server?.nodeId ?? null)
  const addAlloc = useAdminAddAllocation(serverId)
  const removeAlloc = useAdminRemoveAllocation(serverId)
  const setPrimary = useAdminSetPrimaryAllocation(serverId)
  const updateServer = useAdminUpdateServer(serverId)

  const [selectedFree, setSelectedFree] = useState("")
  const [memory, setMemory] = useState<string | null>(null)
  const [cpu, setCpu] = useState<string | null>(null)
  const [disk, setDisk] = useState<string | null>(null)

  if (server === undefined) {
    return <p className="text-muted-foreground text-xs">{t("admin_servers.loading_detail")}</p>
  }

  const bound = detail?.allocations ?? []
  const primaryId = detail?.server.primaryAllocationId ?? null
  const freeAllocations = (nodeAllocs?.allocations ?? []).filter((a) => a.serverId === null)

  const activeMemory = memory ?? String(server.memoryLimitMb)
  const activeCpu = cpu ?? String(server.cpuLimitPercent)
  const activeDisk = disk ?? String(server.diskLimitMb)

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("admin_servers.section.resources")}</CardTitle>
        </CardHeader>
        <CardInner className="p-3 flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>{t("admin_servers.field.memory")}</Label>
              <Input type="number" value={activeMemory} onChange={(e) => setMemory(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("admin_servers.field.cpu")}</Label>
              <Input type="number" value={activeCpu} onChange={(e) => setCpu(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("admin_servers.field.disk")}</Label>
              <Input type="number" value={activeDisk} onChange={(e) => setDisk(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={updateServer.isPending}
              onClick={() =>
                updateServer.mutate({
                  memoryLimitMb: Number(activeMemory),
                  cpuLimitPercent: Number(activeCpu),
                  diskLimitMb: Number(activeDisk),
                })
              }
            >
              {updateServer.isPending ? t("settings.saving") : t("admin_servers.save_resources")}
            </Button>
          </div>
          </CardInner>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin_servers.section.allocations")}</CardTitle>
        </CardHeader>
        <CardInner className="p-3 flex flex-col gap-3">
          <ul className="flex flex-col gap-1">
            {bound.map((a) => (
              <li
                key={a.id}
                className="border-border flex items-center justify-between rounded border px-3 py-2 text-xs"
              >
                <div className="flex items-center gap-2">
                  <code className="font-mono">{a.ip}:{a.port}</code>
                  {a.id === primaryId && (
                    <span className="bg-chart-1/15 text-chart-1 rounded-full px-1.5 py-0.5 text-[0.6rem] font-medium">
                      {t("admin_servers.primary_badge")}
                    </span>
                  )}
                  {a.alias !== null && <span className="text-muted-foreground">{a.alias}</span>}
                </div>
                <div className="flex gap-1.5">
                  {a.id !== primaryId && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs"
                        disabled={setPrimary.isPending}
                        onClick={() => setPrimary.mutate(a.id)}
                      >
                        {t("admin_servers.set_primary")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                        disabled={removeAlloc.isPending}
                        onClick={() => removeAlloc.mutate(a.id)}
                      >
                        {t("admin_servers.unbind")}
                      </Button>
                    </>
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
                      {a.ip}:{a.port}{a.alias ? ` (${a.alias})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                disabled={!selectedFree || addAlloc.isPending}
                onClick={() => addAlloc.mutate(selectedFree, { onSuccess: () => setSelectedFree("") })}
              >
                {t("admin_servers.bind_allocation")}
              </Button>
            </div>
          )}
          {freeAllocations.length === 0 && (
            <p className="text-muted-foreground text-xs">{t("admin_servers.no_free_allocations")}</p>
          )}
          </CardInner>
      </Card>
    </div>
  )
}

const SettingsTab = ({ serverId }: { serverId: string }) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: serversData } = useAdminServers()
  const server = serversData?.servers.find((s) => s.id === serverId)
  const updateServer = useAdminUpdateServer(serverId)
  const reinstall = useAdminReinstallServer(serverId)
  const deleteServer = useAdminDeleteServer()

  const [name, setName] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const [keepFiles, setKeepFiles] = useState(false)
  const [snapshotFirst, setSnapshotFirst] = useState(true)
  const [reinstallConfirm, setReinstallConfirm] = useState(false)
  const [reinstallError, setReinstallError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState("")
  const [deleteError, setDeleteError] = useState<string | null>(null)

  if (server === undefined) {
    return <p className="text-muted-foreground text-xs">{t("admin_servers.loading_detail")}</p>
  }

  const activeName = name ?? server.name

  const handleRename = async () => {
    setNameError(null)
    try {
      await updateServer.mutateAsync({ name: activeName } as never)
    } catch (err) {
      setNameError(
        err instanceof ApiFetchError
          ? translateApiError(t, err.body.error)
          : t("internal.unexpected", { ns: "errors" })
      )
    }
  }

  const handleReinstall = async () => {
    if (!reinstallConfirm) { setReinstallConfirm(true); return }
    setReinstallError(null)
    try {
      await reinstall.mutateAsync({ keepFiles, snapshotFirst })
      setReinstallConfirm(false)
    } catch (err) {
      setReinstallError(
        err instanceof ApiFetchError
          ? translateApiError(t, err.body.error)
          : t("internal.unexpected", { ns: "errors" })
      )
    }
  }

  const handleDelete = async () => {
    setDeleteError(null)
    try {
      await deleteServer.mutateAsync(serverId)
      void navigate({ to: "/admin/servers" })
    } catch (err) {
      setDeleteError(
        err instanceof ApiFetchError
          ? translateApiError(t, err.body.error)
          : t("internal.unexpected", { ns: "errors" })
      )
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.rename_title")}</CardTitle>
        </CardHeader>
        <CardInner className="p-3 flex flex-col gap-3">
          <div className="space-y-1.5">
            <Label>{t("settings.name_label")}</Label>
            <Input
              value={activeName}
              onChange={(e) => setName(e.target.value)}
              maxLength={64}
            />
          </div>
          {nameError !== null && <p className="text-destructive text-xs">{nameError}</p>}
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={updateServer.isPending || activeName.trim().length === 0 || activeName === server.name}
              onClick={() => void handleRename()}
            >
              {updateServer.isPending ? t("settings.saving") : t("actions.save")}
            </Button>
          </div>
          </CardInner>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.reinstall_title")}</CardTitle>
          <CardDescription>{t("settings.reinstall_description")}</CardDescription>
        </CardHeader>
        <CardInner className="p-3 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Checkbox id="keep-files-admin" checked={keepFiles} onCheckedChange={(v) => setKeepFiles(v === true)} />
            <Label htmlFor="keep-files-admin">{t("settings.reinstall_keep_files")}</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="snapshot-admin" checked={snapshotFirst} onCheckedChange={(v) => setSnapshotFirst(v === true)} />
            <Label htmlFor="snapshot-admin">{t("settings.reinstall_snapshot")}</Label>
          </div>
          {reinstallError !== null && <p className="text-destructive text-xs">{reinstallError}</p>}
          <div className="flex justify-end">
            <Button
              size="sm"
              variant={reinstallConfirm ? "destructive" : "secondary"}
              disabled={reinstall.isPending}
              onClick={() => void handleReinstall()}
              onBlur={() => setReinstallConfirm(false)}
            >
              {reinstall.isPending
                ? t("admin_servers.reinstalling")
                : reinstallConfirm
                  ? t("settings.reinstall_confirm")
                  : t("admin_servers.reinstall")}
            </Button>
          </div>
          </CardInner>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">{t("settings.delete_title")}</CardTitle>
          <CardDescription>{t("settings.delete_description")}</CardDescription>
        </CardHeader>
        <CardInner className="p-3 flex flex-col gap-3">
          <p className="text-muted-foreground text-xs">
            {t("settings.delete_confirm_hint", { name: server.name })}
          </p>
          <Input
            value={confirmDelete}
            onChange={(e) => setConfirmDelete(e.target.value)}
            placeholder={server.name}
          />
          {deleteError !== null && <p className="text-destructive text-xs">{deleteError}</p>}
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="destructive"
              disabled={deleteServer.isPending || confirmDelete !== server.name}
              onClick={() => void handleDelete()}
            >
              {deleteServer.isPending ? t("settings.deleting") : t("settings.delete_button")}
            </Button>
          </div>
          </CardInner>
      </Card>
    </div>
  )
}

export const AdminServerPage = () => {
  const { serverId } = useParams({ from: "/admin/servers/$serverId" })
  const { tab } = useSearch({ from: "/admin/servers/$serverId" })
  const navigate = useNavigate()
  const { data: serversData, isLoading } = useAdminServers()
  const server = serversData?.servers.find((s) => s.id === serverId)

  const goTab = (t: Tab) =>
    navigate({ to: "/admin/servers/$serverId", params: { serverId }, search: { tab: t } })

  if (isLoading) {
    return <p className="text-muted-foreground text-xs">Loading…</p>
  }

  if (server === undefined) {
    return <p className="text-muted-foreground text-xs">Server not found.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-base font-semibold">{server.name}</h1>
        <p className="text-muted-foreground text-xs">
          {server.nodeName ?? "—"} · {server.ownerEmail ?? "—"}
        </p>
      </header>

      {/* tab bar */}
      <div className="flex gap-1 border-b pb-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => goTab(t.id)}
            className={[
              "rounded-t px-3 py-1.5 text-xs font-medium transition-colors",
              tab === t.id
                ? "border-b-2 border-foreground text-foreground -mb-px"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* tab content */}
      {tab === "overview" && <OverviewTab serverId={serverId} />}
      {tab === "blueprint" && <BlueprintTab serverId={serverId} />}
      {tab === "allocations" && <AllocationsTab serverId={serverId} />}
      {tab === "settings" && <SettingsTab serverId={serverId} />}
    </div>
  )
}

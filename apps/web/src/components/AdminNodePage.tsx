import { useState } from "react"
import { Link, useParams } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardHeader,
  CardInner,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

import { ApiFetchError } from "@/lib/ApiFetch"
import { translateApiError } from "@/lib/TranslateError"
import {
  useNodes,
  useUpdateNode,
  useDeleteNode,
  useMintPairingToken,
} from "@/hooks/useNodes"
import {
  useAllocations,
  useCreateAllocations,
  useDeleteAllocations,
} from "@/hooks/useAllocations"
import type { NodeListRow, UpdateNodeRequest } from "@/hooks/useNodes.types"
import type { AllocationRow, CreateAllocationsRequest } from "@/hooks/useAllocations.types"

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label className="text-xs">{label}</Label>
    {children}
  </div>
)

const SettingsCard = ({ node }: { node: NodeListRow }) => {
  const { t } = useTranslation()
  const update = useUpdateNode(node.id)

  const [form, setForm] = useState<UpdateNodeRequest>({
    name: node.name,
    fqdn: node.fqdn,
    scheme: node.scheme,
    daemonPort: node.daemonPort,
    sftpPort: node.sftpPort,
    memoryTotalMb: node.memoryTotalMb,
    diskTotalMb: node.diskTotalMb,
  })
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof UpdateNodeRequest>(key: K, val: UpdateNodeRequest[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }))

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    try {
      await update.mutateAsync(form)
    } catch (err) {
      setError(
        err instanceof ApiFetchError
          ? translateApiError(t, err.body.error)
          : t("internal.unexpected", { ns: "errors" })
      )
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("nodes.section.connection")}</CardTitle>
      </CardHeader>
      <CardInner className="p-3">
        <form onSubmit={(e) => void handleSave(e)} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("nodes.create_field.name")}>
              <Input required value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} maxLength={64} />
            </Field>
            <Field label={t("nodes.create_field.fqdn")}>
              <Input required value={form.fqdn ?? ""} onChange={(e) => set("fqdn", e.target.value)} />
            </Field>
            <Field label={t("nodes.create_field.scheme")}>
              <Select value={form.scheme ?? "http"} onValueChange={(v) => set("scheme", v === "https" ? "https" : "http")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="http">http</SelectItem>
                  <SelectItem value="https">https</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("nodes.create_field.daemon_port")}>
              <Input type="number" min={1} max={65535} required value={form.daemonPort ?? 8080} onChange={(e) => set("daemonPort", Number(e.target.value))} />
            </Field>
            <Field label={t("nodes.create_field.sftp_port")}>
              <Input type="number" min={1} max={65535} required value={form.sftpPort ?? 2022} onChange={(e) => set("sftpPort", Number(e.target.value))} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("nodes.create_field.memory_mb")}>
              <Input type="number" min={1} required value={form.memoryTotalMb ?? 0} onChange={(e) => set("memoryTotalMb", Number(e.target.value))} />
            </Field>
            <Field label={t("nodes.create_field.disk_mb")}>
              <Input type="number" min={1} required value={form.diskTotalMb ?? 0} onChange={(e) => set("diskTotalMb", Number(e.target.value))} />
            </Field>
          </div>
          {error !== null && <p className="text-destructive text-xs" role="alert">{error}</p>}
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={update.isPending}>
              {update.isPending ? t("settings.saving") : t("nodes.save_settings")}
            </Button>
          </div>
        </form>
        </CardInner>
    </Card>
  )
}

const PairingTokenCard = ({ nodeId }: { nodeId: string }) => {
  const { t } = useTranslation()
  const mint = useMintPairingToken()
  const [token, setToken] = useState<{ token: string; expiresAt: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleMint = async () => {
    setError(null)
    try {
      const result = await mint.mutateAsync(nodeId)
      setToken({ token: result.token, expiresAt: result.expiresAt })
    } catch (err) {
      setError(
        err instanceof ApiFetchError
          ? translateApiError(t, err.body.error)
          : t("internal.unexpected", { ns: "errors" })
      )
    }
  }

  const command = token !== null ? `stellar-daemon configure ${token.token}` : ""

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("nodes.generate_token")}</CardTitle>
      </CardHeader>
      <CardInner className="p-3 flex flex-col gap-3">
        {token !== null ? (
          <>
            <p className="text-muted-foreground text-xs">
              {t("nodes.token_dialog.body", { expiresAt: token.expiresAt })}
            </p>
            <pre className="bg-muted overflow-x-auto rounded p-2 font-mono text-xs">{command}</pre>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => void navigator.clipboard.writeText(command)}>
                {t("nodes.token_dialog.copy")}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setToken(null)}>
                {t("nodes.token_dialog.done")}
              </Button>
            </div>
          </>
        ) : (
          <>
            {error !== null && <p className="text-destructive text-xs" role="alert">{error}</p>}
            <div className="flex justify-end">
              <Button size="sm" variant="outline" disabled={mint.isPending} onClick={() => void handleMint()}>
                {mint.isPending ? t("nodes.generating_token") : t("nodes.generate_token")}
              </Button>
            </div>
          </>
        )}
        </CardInner>
    </Card>
  )
}

const initialAllocationForm = { ip: "127.0.0.1", startPort: 25565, endPort: 25569, alias: "" }

const AllocationsCard = ({ nodeId }: { nodeId: string }) => {
  const { t } = useTranslation()
  const allocations = useAllocations(nodeId)
  const create = useCreateAllocations(nodeId)
  const remove = useDeleteAllocations(nodeId)

  const [form, setForm] = useState(initialAllocationForm)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [busyDelete, setBusyDelete] = useState<string | null>(null)

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMessage(null)
    if (form.endPort < form.startPort) {
      setErrorMessage(t("nodes.allocations.end_port_error"))
      return
    }
    const body: CreateAllocationsRequest = {
      ip: form.ip.trim(),
      portRange: { start: form.startPort, end: form.endPort },
      ...(form.alias.trim().length > 0 ? { alias: form.alias.trim() } : {}),
    }
    try {
      await create.mutateAsync(body)
      setForm({ ...form, alias: "" })
    } catch (err) {
      setErrorMessage(
        err instanceof ApiFetchError
          ? translateApiError(t, err.body.error)
          : t("internal.unexpected", { ns: "errors" })
      )
    }
  }

  const handleDelete = async (row: AllocationRow) => {
    if (row.serverId !== null) return
    if (!window.confirm(t("nodes.allocations.confirm_delete", { ip: row.ip, port: row.port }))) return
    setBusyDelete(row.id)
    try {
      await remove.mutateAsync([row.id])
    } catch (err) {
      setErrorMessage(
        err instanceof ApiFetchError
          ? translateApiError(t, err.body.error)
          : t("internal.unexpected", { ns: "errors" })
      )
    } finally {
      setBusyDelete(null)
    }
  }

  const rows = allocations.data?.allocations ?? []
  const free = rows.filter((r) => r.serverId === null).length

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("nodes.allocations.heading", { total: rows.length, free })}</CardTitle>
      </CardHeader>
      <CardInner className="p-3 flex flex-col gap-3">
        {allocations.isLoading ? (
          <p className="text-muted-foreground text-xs">{t("nodes.allocations.loading")}</p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground text-xs">{t("nodes.allocations.empty")}</p>
        ) : (
          <ul className="flex flex-wrap gap-1">
            {rows.map((row) => {
              const inUse = row.serverId !== null
              return (
                <li
                  key={row.id}
                  className={`border-border flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[0.65rem] ${inUse ? "opacity-70" : ""}`}
                  title={inUse ? t("nodes.allocations.bound_to", { serverId: row.serverId }) : t("nodes.allocations.free")}
                >
                  <span className={`size-1 rounded-full ${inUse ? "bg-chart-2" : "bg-chart-1"}`} />
                  <span>{row.ip}:{row.port}</span>
                  {!inUse && (
                    <button
                      type="button"
                      onClick={() => void handleDelete(row)}
                      disabled={busyDelete === row.id}
                      className="text-destructive ml-1"
                      title={t("actions.delete")}
                    >
                      ✕
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        <form className="grid grid-cols-2 gap-2 sm:grid-cols-5" onSubmit={(e) => void handleAdd(e)}>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">{t("nodes.allocations.field.ip")}</Label>
            <Input value={form.ip} onChange={(e) => setForm({ ...form, ip: e.target.value })} required className="h-7 text-xs" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">{t("nodes.allocations.field.start_port")}</Label>
            <Input type="number" min={1} max={65535} value={form.startPort} onChange={(e) => setForm({ ...form, startPort: Number(e.target.value) })} required className="h-7 text-xs" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">{t("nodes.allocations.field.end_port")}</Label>
            <Input type="number" min={1} max={65535} value={form.endPort} onChange={(e) => setForm({ ...form, endPort: Number(e.target.value) })} required className="h-7 text-xs" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">{t("nodes.allocations.field.alias")}</Label>
            <Input value={form.alias} onChange={(e) => setForm({ ...form, alias: e.target.value })} className="h-7 text-xs" />
          </div>
          <div className="flex items-end">
            <Button type="submit" size="sm" disabled={create.isPending} className="w-full">
              {create.isPending ? t("nodes.allocations.add_pending") : t("nodes.allocations.add_button")}
            </Button>
          </div>
        </form>
        {errorMessage !== null && (
          <p className="text-destructive text-xs" role="alert">{errorMessage}</p>
        )}
        </CardInner>
    </Card>
  )
}

const DangerCard = ({ node }: { node: NodeListRow }) => {
  const { t } = useTranslation()
  const deleteNode = useDeleteNode()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setError(null)
    try {
      await deleteNode.mutateAsync(node.id)
      window.location.href = "/admin/nodes"
    } catch (err) {
      setConfirming(false)
      setError(
        err instanceof ApiFetchError
          ? translateApiError(t, err.body.error)
          : t("internal.unexpected", { ns: "errors" })
      )
    }
  }

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive">{t("admin_servers.section.danger")}</CardTitle>
      </CardHeader>
      <CardInner className="p-3 flex flex-col gap-3">
        <p className="text-muted-foreground text-xs">{t("nodes.delete_confirm", { name: node.name })}</p>
        {error !== null && <p className="text-destructive text-xs" role="alert">{error}</p>}
        <div className="flex justify-end">
          <Button
            size="sm"
            variant={confirming ? "destructive" : "outline"}
            disabled={deleteNode.isPending}
            onClick={() => {
              if (!confirming) { setConfirming(true); return }
              void handleDelete()
            }}
            onBlur={() => setConfirming(false)}
          >
            {deleteNode.isPending ? "Deleting…" : confirming ? t("actions.confirm") : t("nodes.delete")}
          </Button>
        </div>
        </CardInner>
    </Card>
  )
}

const NodeNotFound = () => {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-base font-semibold">{t("nodes.title")}</h1>
        <p className="text-muted-foreground text-xs">{t("nodes.not_found", { ns: "errors" })}</p>
      </header>
      <Button variant="outline" size="sm" asChild className="self-start">
        <Link to="/admin/nodes">{t("actions.cancel")}</Link>
      </Button>
    </div>
  )
}

export const AdminNodePage = () => {
  const { t } = useTranslation()
  const { nodeId } = useParams({ from: "/admin/nodes/$nodeId" })
  const { data, isLoading } = useNodes()

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-muted-foreground text-xs">{t("nodes.loading")}</p>
      </div>
    )
  }

  const node = data?.nodes.find((n) => n.id === nodeId)
  if (node === undefined) return <NodeNotFound />

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-base font-semibold">{node.name}</h1>
          <p className="text-muted-foreground font-mono text-xs">{node.fqdn}</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin/nodes">{t("actions.cancel")}</Link>
        </Button>
      </header>

      <SettingsCard node={node} />
      <PairingTokenCard nodeId={node.id} />
      <AllocationsCard nodeId={node.id} />
      <DangerCard node={node} />
    </div>
  )
}

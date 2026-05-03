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
import { useCreateNode } from "@/hooks/useNodes"
import type { CreateNodeRequest } from "@/hooks/useNodes.types"

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label className="text-xs">{label}</Label>
    {children}
  </div>
)

const initialForm: CreateNodeRequest = {
  name: "",
  fqdn: "",
  scheme: "http",
  daemonPort: 8080,
  sftpPort: 2022,
  memoryTotalMb: 4096,
  diskTotalMb: 50_000,
}

export const AdminNewNodePage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const create = useCreateNode()

  const [form, setForm] = useState<CreateNodeRequest>(initialForm)
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof CreateNodeRequest>(key: K, val: CreateNodeRequest[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }))

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    try {
      await create.mutateAsync(form)
      void navigate({ to: "/admin/nodes" as string })
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
          <h1 className="text-base font-semibold">{t("nodes.create_title")}</h1>
          <p className="text-muted-foreground text-xs">{t("nodes.create_description")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void navigate({ to: "/admin/nodes" as string })}>
          {t("actions.cancel")}
        </Button>
      </header>

      <form className="flex flex-col gap-4" onSubmit={(e) => void handleSubmit(e)}>
        <Card>
          <CardHeader>
            <CardTitle>{t("nodes.section.connection")}</CardTitle>
          </CardHeader>
          <CardInner className="p-3 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("nodes.create_field.name")}>
                <Input
                  required
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  maxLength={64}
                  placeholder="Node 1"
                />
              </Field>
              <Field label={t("nodes.create_field.fqdn")}>
                <Input
                  required
                  value={form.fqdn}
                  onChange={(e) => set("fqdn", e.target.value)}
                  placeholder="node1.example.com"
                />
              </Field>
              <Field label={t("nodes.create_field.scheme")}>
                <Select
                  value={form.scheme}
                  onValueChange={(v) => set("scheme", v === "https" ? "https" : "http")}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="http">http</SelectItem>
                    <SelectItem value="https">https</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t("nodes.create_field.daemon_port")}>
                <Input
                  type="number"
                  min={1}
                  max={65535}
                  required
                  value={form.daemonPort}
                  onChange={(e) => set("daemonPort", Number(e.target.value))}
                />
              </Field>
              <Field label={t("nodes.create_field.sftp_port")}>
                <Input
                  type="number"
                  min={1}
                  max={65535}
                  required
                  value={form.sftpPort}
                  onChange={(e) => set("sftpPort", Number(e.target.value))}
                />
              </Field>
            </div>
            </CardInner>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("nodes.section.resources")}</CardTitle>
          </CardHeader>
          <CardInner className="p-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("nodes.create_field.memory_mb")}>
                <Input
                  type="number"
                  min={1}
                  required
                  value={form.memoryTotalMb}
                  onChange={(e) => set("memoryTotalMb", Number(e.target.value))}
                />
              </Field>
              <Field label={t("nodes.create_field.disk_mb")}>
                <Input
                  type="number"
                  min={1}
                  required
                  value={form.diskTotalMb}
                  onChange={(e) => set("diskTotalMb", Number(e.target.value))}
                />
              </Field>
            </div>
            </CardInner>
        </Card>

        {error !== null && (
          <p className="text-destructive text-xs" role="alert">{error}</p>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={create.isPending || !form.name || !form.fqdn}>
            {create.isPending ? t("nodes.create_pending") : t("nodes.create_button")}
          </Button>
        </div>
      </form>
    </div>
  )
}

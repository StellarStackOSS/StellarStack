import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardAction,
  CardHeader,
  CardInner,
  CardTitle,
} from "@workspace/ui/components/card"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

import { ApiFetchError } from "@/lib/ApiFetch"
import { translateApiError } from "@/lib/TranslateError"
import { useServerLayout } from "@/components/ServerLayoutContext"
import { ScheduleFlowEditor } from "@/components/server/ScheduleFlowEditor"
import {
  useCreateSchedule,
  useDeleteSchedule,
  useSchedules,
  useUpdateSchedule,
} from "@/hooks/useSchedules"
import type {
  ScheduleInput,
  ScheduleRow,
} from "@/hooks/useSchedules.types"

type Draft = {
  name: string
  cron: string
  enabled: boolean
  onlyWhenOnline: boolean
  flow: ScheduleInput["flow"]
}

const newId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return Array.from({ length: 36 }, () => Math.random().toString(16).slice(2))
    .join("")
    .slice(0, 36)
}

const emptyDraft = (): Draft => ({
  name: "",
  cron: "0 4 * * *",
  enabled: true,
  onlyWhenOnline: false,
  flow: {
    nodes: [
      {
        id: newId(),
        kind: "trigger",
        subtype: "cron",
        payload: {},
        position: { x: 120, y: 0 },
      },
    ],
    edges: [],
  },
})

const draftFromRow = (row: ScheduleRow): Draft => ({
  name: row.name,
  cron: row.cron,
  enabled: row.enabled,
  onlyWhenOnline: row.onlyWhenOnline,
  flow: {
    nodes: row.flow.nodes.map((n) => ({
      id: n.id,
      kind: n.kind,
      subtype: n.subtype,
      payload: (n.payload ?? {}) as Record<string, unknown>,
      position: n.position,
    })),
    edges: row.flow.edges.map((e) => ({
      fromNodeId: e.fromNodeId,
      toNodeId: e.toNodeId,
    })),
  },
})

const formatTimestamp = (iso: string | null): string => {
  if (iso === null) return "—"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString()
}

export const SchedulesTab = () => {
  const { t } = useTranslation()
  const { server } = useServerLayout()
  const schedules = useSchedules(server.id)
  const createSchedule = useCreateSchedule(server.id)
  const updateSchedule = useUpdateSchedule(server.id)
  const deleteSchedule = useDeleteSchedule(server.id)

  const [editingId, setEditingId] = useState<string | "new" | null>(null)
  const [draft, setDraft] = useState<Draft>(() => emptyDraft())
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const rows = useMemo(
    () => schedules.data?.schedules ?? [],
    [schedules.data]
  )

  const startNew = () => {
    setEditingId("new")
    setDraft(emptyDraft())
    setErrorMessage(null)
  }

  const startEdit = (row: ScheduleRow) => {
    setEditingId(row.id)
    setDraft(draftFromRow(row))
    setErrorMessage(null)
  }

  const cancel = () => {
    setEditingId(null)
    setDraft(emptyDraft())
    setErrorMessage(null)
  }

  const buildPayload = (d: Draft): ScheduleInput | { error: string } => {
    if (d.name.trim().length === 0) {
      return { error: t("schedules.error.name_required") }
    }
    if (d.cron.trim().length === 0) {
      return { error: t("schedules.error.cron_required") }
    }
    if (d.flow.nodes.length === 0) {
      return { error: t("schedules.error.flow_empty") }
    }
    const triggers = d.flow.nodes.filter((n) => n.kind === "trigger")
    if (triggers.length !== 1) {
      return { error: t("schedules.error.flow_invalid") }
    }
    return {
      name: d.name.trim(),
      cron: d.cron.trim(),
      enabled: d.enabled,
      onlyWhenOnline: d.onlyWhenOnline,
      flow: {
        nodes: d.flow.nodes.map((n) => ({
          id: n.id,
          kind: n.kind,
          subtype: n.subtype,
          payload: n.payload,
          position: n.position,
        })),
        edges: d.flow.edges.map((e) => ({
          fromNodeId: e.fromNodeId,
          toNodeId: e.toNodeId,
        })),
      },
    }
  }

  const handleSave = async () => {
    setErrorMessage(null)
    const payload = buildPayload(draft)
    if ("error" in payload) {
      setErrorMessage(payload.error)
      return
    }
    try {
      if (editingId === "new") {
        await createSchedule.mutateAsync(payload)
      } else if (editingId !== null) {
        await updateSchedule.mutateAsync({ scheduleId: editingId, ...payload })
      }
      cancel()
    } catch (err) {
      if (err instanceof ApiFetchError) {
        setErrorMessage(translateApiError(t, err.body.error))
      } else {
        setErrorMessage(t("internal.unexpected", { ns: "errors" }))
      }
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteSchedule.mutateAsync(id)
    } catch (err) {
      if (err instanceof ApiFetchError) {
        setErrorMessage(translateApiError(t, err.body.error))
      }
    }
  }

  if (editingId !== null) {
    return (
      <ScheduleEditor
        draft={draft}
        onChange={setDraft}
        errorMessage={errorMessage}
        isSaving={createSchedule.isPending || updateSchedule.isPending}
        onCancel={cancel}
        onSave={() => void handleSave()}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("schedules.title")}</CardTitle>
          <CardAction>
            <Button size="sm" onClick={startNew}>
              {t("schedules.new")}
            </Button>
          </CardAction>
        </CardHeader>
        <CardInner className="p-3">
          <p className="text-sm text-muted-foreground">
            {t("schedules.description")}
          </p>
        </CardInner>
      </Card>

      {schedules.isLoading ? (
        <p className="text-xs text-muted-foreground">{t("schedules.loading")}</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("schedules.empty")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row) => (
            <ScheduleSummaryCard
              key={row.id}
              row={row}
              onEdit={() => startEdit(row)}
              onDelete={() => void handleDelete(row.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Summary card per schedule on the list view.
// ---------------------------------------------------------------------------

const ScheduleSummaryCard = ({
  row,
  onEdit,
  onDelete,
}: {
  row: ScheduleRow
  onEdit: () => void
  onDelete: () => void
}) => {
  const { t } = useTranslation()
  const actionCount = row.flow.nodes.filter((n) => n.kind === "action").length
  const waitCount = row.flow.nodes.filter((n) => n.kind === "wait").length
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span
            className={`size-1.5 rounded-full ${
              row.enabled ? "bg-chart-1" : "bg-muted-foreground"
            }`}
          />
          <span>{row.name}</span>
          <span className="font-mono text-xs text-muted-foreground">
            {row.cron}
          </span>
        </CardTitle>
        <CardAction>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onEdit}>
              {t("schedules.edit")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive"
              onClick={onDelete}
            >
              {t("schedules.delete")}
            </Button>
          </div>
        </CardAction>
      </CardHeader>
      <CardInner className="grid grid-cols-2 gap-3 p-3 text-xs md:grid-cols-4">
        <Stat
          label={t("schedules.actions")}
          value={String(actionCount)}
        />
        <Stat label={t("schedules.waits")} value={String(waitCount)} />
        <Stat
          label={t("schedules.next_run")}
          value={formatTimestamp(row.nextRunAt)}
        />
        <Stat
          label={t("schedules.last_run")}
          value={formatTimestamp(row.lastRunAt)}
        />
      </CardInner>
    </Card>
  )
}

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
      {label}
    </span>
    <span className="font-mono text-xs text-foreground">{value}</span>
  </div>
)

// ---------------------------------------------------------------------------
// Editor view — replaces the list when editing/creating.
// ---------------------------------------------------------------------------

const ScheduleEditor = ({
  draft,
  onChange,
  errorMessage,
  isSaving,
  onCancel,
  onSave,
}: {
  draft: Draft
  onChange: (next: Draft) => void
  errorMessage: string | null
  isSaving: boolean
  onCancel: () => void
  onSave: () => void
}) => {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("schedules.editor_title")}</CardTitle>
          <CardAction>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onCancel}>
                {t("actions.cancel", { defaultValue: "Cancel" })}
              </Button>
              <Button size="sm" disabled={isSaving} onClick={onSave}>
                {isSaving
                  ? t("schedules.saving", { defaultValue: "Saving…" })
                  : t("schedules.save", { defaultValue: "Save" })}
              </Button>
            </div>
          </CardAction>
        </CardHeader>
        <CardInner className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2">
          <Field label={t("schedules.name")}>
            <Input
              value={draft.name}
              onChange={(e) =>
                onChange({ ...draft, name: e.currentTarget.value })
              }
              placeholder={t("schedules.name_placeholder", {
                defaultValue: "Nightly backup",
              })}
            />
          </Field>
          <Field label={t("schedules.cron")}>
            <Input
              value={draft.cron}
              onChange={(e) =>
                onChange({ ...draft, cron: e.currentTarget.value })
              }
              placeholder="0 4 * * *"
            />
          </Field>
          <CheckboxRow
            label={t("schedules.enabled")}
            checked={draft.enabled}
            onChange={(v) => onChange({ ...draft, enabled: v })}
          />
          <CheckboxRow
            label={t("schedules.only_when_online")}
            checked={draft.onlyWhenOnline}
            onChange={(v) => onChange({ ...draft, onlyWhenOnline: v })}
          />
        </CardInner>
        {errorMessage !== null ? (
          <CardInner className="px-3 pb-3 text-xs text-destructive" role="alert">
            {errorMessage}
          </CardInner>
        ) : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("schedules.flow")}</CardTitle>
        </CardHeader>
        <CardInner className="p-0">
          <ScheduleFlowEditor
            initialFlow={draft.flow}
            onChange={(flow) => onChange({ ...draft, flow })}
          />
        </CardInner>
      </Card>
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
    <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
      {label}
    </Label>
    {children}
  </div>
)

const CheckboxRow = ({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) => (
  <label className="flex items-center gap-2 text-xs text-foreground">
    <Checkbox
      checked={checked}
      onCheckedChange={(v) => onChange(v === true)}
    />
    <span>{label}</span>
  </label>
)

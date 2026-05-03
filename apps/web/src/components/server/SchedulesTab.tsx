import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"

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

import { ApiFetchError } from "@/lib/ApiFetch"
import { translateApiError } from "@/lib/TranslateError"
import { useServerLayout } from "@/components/ServerLayoutContext"
import {
  useCreateSchedule,
  useDeleteSchedule,
  useSchedules,
  useUpdateSchedule,
} from "@/hooks/useSchedules"
import type {
  ScheduleInput,
  ScheduleRow,
  ScheduleTaskRow,
} from "@/hooks/useSchedules.types"

type DraftTask = {
  sortOrder: number
  action: ScheduleTaskRow["action"]
  delaySeconds: number
  payloadJson: string
}

type Draft = {
  name: string
  cron: string
  enabled: boolean
  onlyWhenOnline: boolean
  tasks: DraftTask[]
}

const emptyDraft: Draft = {
  name: "",
  cron: "0 4 * * *",
  enabled: true,
  onlyWhenOnline: false,
  tasks: [
    {
      sortOrder: 0,
      action: "backup",
      delaySeconds: 0,
      payloadJson: "{}",
    },
  ],
}

const draftFromRow = (row: ScheduleRow): Draft => ({
  name: row.name,
  cron: row.cron,
  enabled: row.enabled,
  onlyWhenOnline: row.onlyWhenOnline,
  tasks: row.tasks
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((t) => ({
      sortOrder: t.sortOrder,
      action: t.action,
      delaySeconds: t.delaySeconds,
      payloadJson: JSON.stringify(t.payload ?? {}),
    })),
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
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const rows = schedules.data?.schedules ?? []

  const startNew = () => {
    setEditingId("new")
    setDraft(emptyDraft)
    setErrorMessage(null)
  }

  const startEdit = (row: ScheduleRow) => {
    setEditingId(row.id)
    setDraft(draftFromRow(row))
    setErrorMessage(null)
  }

  const cancel = () => {
    setEditingId(null)
    setDraft(emptyDraft)
    setErrorMessage(null)
  }

  const buildPayload = (d: Draft): ScheduleInput | { error: string } => {
    if (d.name.trim().length === 0) {
      return { error: t("schedules.error.name_required") }
    }
    if (d.cron.trim().length === 0) {
      return { error: t("schedules.error.cron_required") }
    }
    const tasks: ScheduleInput["tasks"] = []
    for (const task of d.tasks) {
      let payload: Record<string, string | number | boolean> | null = null
      const trimmed = task.payloadJson.trim()
      if (trimmed.length > 0 && trimmed !== "{}") {
        try {
          const parsed = JSON.parse(trimmed) as unknown
          if (
            typeof parsed !== "object" ||
            parsed === null ||
            Array.isArray(parsed)
          ) {
            return { error: t("schedules.error.payload_not_object", { num: task.sortOrder + 1 }) }
          }
          payload = parsed as Record<string, string | number | boolean>
        } catch {
          return { error: t("schedules.error.payload_invalid_json", { num: task.sortOrder + 1 }) }
        }
      } else if (trimmed === "{}") {
        payload = {}
      }
      tasks.push({
        sortOrder: task.sortOrder,
        action: task.action,
        delaySeconds: task.delaySeconds,
        payload,
      })
    }
    return {
      name: d.name.trim(),
      cron: d.cron.trim(),
      enabled: d.enabled,
      onlyWhenOnline: d.onlyWhenOnline,
      tasks,
    }
  }

  const save = async () => {
    const result = buildPayload(draft)
    if ("error" in result) {
      setErrorMessage(result.error)
      return
    }
    try {
      if (editingId === "new") {
        await createSchedule.mutateAsync(result)
      } else if (editingId !== null) {
        await updateSchedule.mutateAsync({ scheduleId: editingId, ...result })
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

  const remove = async (row: ScheduleRow) => {
    try {
      await deleteSchedule.mutateAsync(row.id)
    } catch (err) {
      if (err instanceof ApiFetchError) {
        setErrorMessage(translateApiError(t, err.body.error))
      } else {
        setErrorMessage(t("internal.unexpected", { ns: "errors" }))
      }
    }
  }

  const toggleEnabled = async (row: ScheduleRow) => {
    try {
      await updateSchedule.mutateAsync({
        scheduleId: row.id,
        enabled: !row.enabled,
      })
    } catch (err) {
      if (err instanceof ApiFetchError) {
        setErrorMessage(translateApiError(t, err.body.error))
      } else {
        setErrorMessage(t("internal.unexpected", { ns: "errors" }))
      }
    }
  }

  const columns = useMemo<ColumnDef<ScheduleRow>[]>(
    () => [
      {
        id: "name",
        header: t("schedules.col.name"),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span
              className={`size-1.5 shrink-0 rounded-full ${
                row.original.enabled ? "bg-chart-1" : "bg-muted-foreground"
              }`}
            />
            <span className="text-xs font-medium">{row.original.name}</span>
            {row.original.onlyWhenOnline ? (
              <span className="bg-muted rounded px-1 py-0.5 text-[0.6rem] uppercase">
                {t("schedules.online_only_badge")}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        id: "cron",
        header: t("schedules.col.cron"),
        cell: ({ row }) => (
          <code className="text-muted-foreground font-mono text-xs">
            {row.original.cron}
          </code>
        ),
      },
      {
        id: "tasks",
        header: t("schedules.col.tasks"),
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">
            {t(
              row.original.tasks.length === 1
                ? "schedules.task_count"
                : "schedules.task_count_plural",
              { count: row.original.tasks.length }
            )}
          </span>
        ),
      },
      {
        id: "last_run",
        header: t("schedules.col.last_run"),
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">
            {formatTimestamp(row.original.lastRunAt)}
          </span>
        ),
      },
      {
        id: "next_run",
        header: t("schedules.col.next_run"),
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">
            {formatTimestamp(row.original.nextRunAt)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            <Button
              size="xs"
              variant="outline"
              disabled={updateSchedule.isPending}
              onClick={() => void toggleEnabled(row.original)}
            >
              {row.original.enabled ? t("schedules.pause") : t("schedules.resume")}
            </Button>
            <Button
              size="xs"
              variant="outline"
              onClick={() => startEdit(row.original)}
            >
              {t("schedules.edit")}
            </Button>
            <Button
              size="xs"
              variant="destructive"
              disabled={deleteSchedule.isPending}
              onClick={() => void remove(row.original)}
            >
              {t("schedules.delete")}
            </Button>
          </div>
        ),
      },
    ],
    [t, updateSchedule.isPending, deleteSchedule.isPending]
  )

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="flex flex-col gap-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{t("schedules.title")}</CardTitle>
          {editingId === null ? (
            <CardAction>
              <Button size="sm" onClick={startNew}>
                {t("schedules.new_button")}
              </Button>
            </CardAction>
          ) : null}
        </CardHeader>
        <CardInner className="p-3">
          <p className="text-sm text-muted-foreground">{t("schedules.description")}</p>
        </CardInner>
      </Card>

      {errorMessage !== null ? (
        <p className="text-destructive text-xs" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {editingId !== null ? (
        <ScheduleEditor
          draft={draft}
          onChange={setDraft}
          onCancel={cancel}
          onSave={() => void save()}
          saving={createSchedule.isPending || updateSchedule.isPending}
          isNew={editingId === "new"}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("schedules.configured_heading")}</CardTitle>
          <CardAction>
            <span className="text-muted-foreground text-xs">
              {t(
                rows.length === 1 ? "schedules.count_one" : "schedules.count_other",
                { count: rows.length }
              )}
            </span>
          </CardAction>
        </CardHeader>
        <CardInner className="p-3">
          {schedules.isLoading ? (
            <p className="text-muted-foreground text-xs">{t("schedules.loading")}</p>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground text-xs">{t("schedules.empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id}>
                    {hg.headers.map((header) => (
                      <TableHead key={header.id}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          </CardInner>
      </Card>
    </div>
  )
}

const ScheduleEditor = (props: {
  draft: Draft
  onChange: (next: Draft) => void
  onCancel: () => void
  onSave: () => void
  saving: boolean
  isNew: boolean
}) => {
  const { t } = useTranslation()
  const { draft, onChange, onCancel, onSave, saving, isNew } = props

  const updateTask = (index: number, patch: Partial<DraftTask>) => {
    onChange({
      ...draft,
      tasks: draft.tasks.map((task, i) => (i === index ? { ...task, ...patch } : task)),
    })
  }

  const addTask = () => {
    onChange({
      ...draft,
      tasks: [
        ...draft.tasks,
        {
          sortOrder: draft.tasks.length,
          action: "command",
          delaySeconds: 0,
          payloadJson: '{"line":"say hello"}',
        },
      ],
    })
  }

  const removeTask = (index: number) => {
    onChange({
      ...draft,
      tasks: draft.tasks
        .filter((_, i) => i !== index)
        .map((task, i) => ({ ...task, sortOrder: i })),
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isNew ? t("schedules.editor.new_title") : t("schedules.editor.edit_title")}
        </CardTitle>
      </CardHeader>
      <CardInner className="p-3 flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">{t("schedules.editor.name_label")}</Label>
            <Input
              value={draft.name}
              onChange={(e) => onChange({ ...draft, name: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">{t("schedules.editor.cron_label")}</Label>
            <Input
              value={draft.cron}
              onChange={(e) => onChange({ ...draft, cron: e.target.value })}
              placeholder="0 4 * * *"
              className="font-mono"
            />
          </div>
          <label className="flex items-center gap-2 text-xs">
            <Checkbox
              checked={draft.enabled}
              onCheckedChange={(checked) =>
                onChange({ ...draft, enabled: checked === true })
              }
            />
            <span>{t("schedules.editor.enabled_label")}</span>
          </label>
          <label className="flex items-center gap-2 text-xs">
            <Checkbox
              checked={draft.onlyWhenOnline}
              onCheckedChange={(checked) =>
                onChange({ ...draft, onlyWhenOnline: checked === true })
              }
            />
            <span>{t("schedules.editor.online_only_label")}</span>
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <header className="flex items-center justify-between">
            <h3 className="text-xs font-medium uppercase">
              {t("schedules.editor.tasks_heading")}
            </h3>
            <Button size="xs" variant="outline" onClick={addTask}>
              {t("schedules.editor.add_task")}
            </Button>
          </header>
          <ul className="flex flex-col gap-2">
            {draft.tasks.map((task, index) => (
              <li
                key={index}
                className="border-border grid grid-cols-1 gap-2 rounded border p-2 text-xs sm:grid-cols-12"
              >
                <div className="flex flex-col gap-1 sm:col-span-3">
                  <Label className="text-xs">{t("schedules.editor.action_label")}</Label>
                  <Select
                    value={task.action}
                    onValueChange={(v) =>
                      updateTask(index, { action: v as ScheduleTaskRow["action"] })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="power">{t("schedules.editor.action_power")}</SelectItem>
                      <SelectItem value="command">{t("schedules.editor.action_command")}</SelectItem>
                      <SelectItem value="backup">{t("schedules.editor.action_backup")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <Label className="text-xs">{t("schedules.editor.delay_label")}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={task.delaySeconds}
                    onChange={(e) =>
                      updateTask(index, { delaySeconds: Number(e.target.value || 0) })
                    }
                  />
                </div>
                <div className="flex flex-col gap-1 sm:col-span-6">
                  <Label className="text-xs">{t("schedules.editor.payload_label")}</Label>
                  <Input
                    value={task.payloadJson}
                    onChange={(e) => updateTask(index, { payloadJson: e.target.value })}
                    placeholder={
                      task.action === "power"
                        ? '{"action":"restart"}'
                        : task.action === "command"
                          ? '{"line":"say hello"}'
                          : '{"name":"daily"}'
                    }
                    className="font-mono"
                  />
                </div>
                <div className="flex items-end sm:col-span-1">
                  <Button size="xs" variant="destructive" onClick={() => removeTask(index)}>
                    ×
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onCancel}>
            {t("schedules.editor.cancel")}
          </Button>
          <Button size="sm" onClick={onSave} disabled={saving}>
            {isNew ? t("schedules.editor.create") : t("schedules.editor.save")}
          </Button>
        </div>
        </CardInner>
    </Card>
  )
}

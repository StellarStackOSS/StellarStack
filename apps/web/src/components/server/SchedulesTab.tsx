import { useState } from "react"

import { Button } from "@workspace/ui/components/button"

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

const buildPayload = (draft: Draft): ScheduleInput | { error: string } => {
  if (draft.name.trim().length === 0) {
    return { error: "Name is required." }
  }
  if (draft.cron.trim().length === 0) {
    return { error: "Cron expression is required." }
  }
  const tasks: ScheduleInput["tasks"] = []
  for (const t of draft.tasks) {
    let payload: Record<string, string | number | boolean> | null = null
    const trimmed = t.payloadJson.trim()
    if (trimmed.length > 0 && trimmed !== "{}") {
      try {
        const parsed = JSON.parse(trimmed) as unknown
        if (
          typeof parsed !== "object" ||
          parsed === null ||
          Array.isArray(parsed)
        ) {
          return { error: `Task ${t.sortOrder + 1} payload must be an object.` }
        }
        payload = parsed as Record<string, string | number | boolean>
      } catch {
        return { error: `Task ${t.sortOrder + 1} payload is not valid JSON.` }
      }
    } else if (trimmed === "{}") {
      payload = {}
    }
    tasks.push({
      sortOrder: t.sortOrder,
      action: t.action,
      delaySeconds: t.delaySeconds,
      payload,
    })
  }
  return {
    name: draft.name.trim(),
    cron: draft.cron.trim(),
    enabled: draft.enabled,
    onlyWhenOnline: draft.onlyWhenOnline,
    tasks,
  }
}

const formatTimestamp = (iso: string | null): string => {
  if (iso === null) return "—"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString()
}

/**
 * `/servers/$id/schedules` — owner-facing cron editor. Lists existing
 * schedules with their task chain and last/next-run timestamps; lets the
 * user create, edit, and revoke. Tasks are stored as a raw JSON payload
 * to keep this tab small while still covering power/command/backup.
 */
export const SchedulesTab = () => {
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
      setErrorMessage(err instanceof Error ? err.message : String(err))
    }
  }

  const remove = async (row: ScheduleRow) => {
    if (!window.confirm(`Delete schedule "${row.name}"?`)) return
    try {
      await deleteSchedule.mutateAsync(row.id)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err))
    }
  }

  const toggleEnabled = async (row: ScheduleRow) => {
    try {
      await updateSchedule.mutateAsync({
        scheduleId: row.id,
        enabled: !row.enabled,
      })
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold">Schedules</h1>
          <p className="text-muted-foreground text-xs">
            Cron-driven power actions, console commands, and backups. Times
            are evaluated in UTC.
          </p>
        </div>
        {editingId === null ? (
          <Button size="sm" onClick={startNew}>
            New schedule
          </Button>
        ) : null}
      </header>

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

      <section className="border-border bg-card text-card-foreground rounded-md border p-4">
        <header className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium">Configured</h2>
          <span className="text-muted-foreground text-xs">
            {rows.length} schedule{rows.length === 1 ? "" : "s"}
          </span>
        </header>
        {schedules.isLoading ? (
          <p className="text-muted-foreground text-xs">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            No schedules yet. Create one to run on a cron.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className="border-border flex flex-col gap-1 rounded border px-3 py-2 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`size-1.5 rounded-full ${row.enabled ? "bg-chart-1" : "bg-muted-foreground"}`}
                      />
                      <span className="truncate font-medium">{row.name}</span>
                      <span className="text-muted-foreground font-mono">
                        {row.cron}
                      </span>
                      {row.onlyWhenOnline ? (
                        <span className="bg-muted rounded px-1 py-0.5 text-[0.6rem] uppercase">
                          online-only
                        </span>
                      ) : null}
                    </div>
                    <div className="text-muted-foreground mt-1 truncate">
                      {row.tasks.length} task
                      {row.tasks.length === 1 ? "" : "s"} · last{" "}
                      {formatTimestamp(row.lastRunAt)} · next{" "}
                      {formatTimestamp(row.nextRunAt)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => void toggleEnabled(row)}
                      disabled={updateSchedule.isPending}
                    >
                      {row.enabled ? "Pause" : "Resume"}
                    </Button>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => startEdit(row)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="xs"
                      variant="destructive"
                      disabled={deleteSchedule.isPending}
                      onClick={() => void remove(row)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
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
  const { draft, onChange, onCancel, onSave, saving, isNew } = props

  const updateTask = (index: number, patch: Partial<DraftTask>) => {
    onChange({
      ...draft,
      tasks: draft.tasks.map((t, i) => (i === index ? { ...t, ...patch } : t)),
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
        .map((t, i) => ({ ...t, sortOrder: i })),
    })
  }

  return (
    <section className="border-border bg-card text-card-foreground flex flex-col gap-3 rounded-md border p-4">
      <header>
        <h2 className="text-sm font-medium">
          {isNew ? "New schedule" : "Edit schedule"}
        </h2>
      </header>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs">
          <span>Name</span>
          <input
            value={draft.name}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
            className="border-border bg-background h-8 rounded-md border px-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span>Cron (UTC)</span>
          <input
            value={draft.cron}
            onChange={(e) => onChange({ ...draft, cron: e.target.value })}
            placeholder="0 4 * * *"
            className="border-border bg-background h-8 rounded-md border px-2 font-mono"
          />
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => onChange({ ...draft, enabled: e.target.checked })}
          />
          <span>Enabled</span>
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={draft.onlyWhenOnline}
            onChange={(e) =>
              onChange({ ...draft, onlyWhenOnline: e.target.checked })
            }
          />
          <span>Only run when server is online</span>
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <header className="flex items-center justify-between">
          <h3 className="text-xs font-medium uppercase">Tasks</h3>
          <Button size="xs" variant="outline" onClick={addTask}>
            Add task
          </Button>
        </header>
        <ul className="flex flex-col gap-2">
          {draft.tasks.map((task, index) => (
            <li
              key={index}
              className="border-border grid grid-cols-1 gap-2 rounded border p-2 text-xs sm:grid-cols-12"
            >
              <label className="flex flex-col gap-1 sm:col-span-3">
                <span>Action</span>
                <select
                  value={task.action}
                  onChange={(e) =>
                    updateTask(index, {
                      action: e.target.value as ScheduleTaskRow["action"],
                    })
                  }
                  className="border-border bg-background h-8 rounded-md border px-2"
                >
                  <option value="power">Power</option>
                  <option value="command">Command</option>
                  <option value="backup">Backup</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span>Delay (s)</span>
                <input
                  type="number"
                  min={0}
                  value={task.delaySeconds}
                  onChange={(e) =>
                    updateTask(index, {
                      delaySeconds: Number(e.target.value || 0),
                    })
                  }
                  className="border-border bg-background h-8 rounded-md border px-2"
                />
              </label>
              <label className="flex flex-col gap-1 sm:col-span-6">
                <span>Payload (JSON)</span>
                <input
                  value={task.payloadJson}
                  onChange={(e) =>
                    updateTask(index, { payloadJson: e.target.value })
                  }
                  placeholder={
                    task.action === "power"
                      ? '{"action":"restart"}'
                      : task.action === "command"
                        ? '{"line":"say hello"}'
                        : '{"name":"daily"}'
                  }
                  className="border-border bg-background h-8 rounded-md border px-2 font-mono"
                />
              </label>
              <div className="flex items-end sm:col-span-1">
                <Button
                  size="xs"
                  variant="destructive"
                  onClick={() => removeTask(index)}
                >
                  ×
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={onSave} disabled={saving}>
          {isNew ? "Create" : "Save"}
        </Button>
      </div>
    </section>
  )
}

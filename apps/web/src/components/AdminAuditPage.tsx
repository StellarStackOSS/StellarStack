import { useState } from "react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"

import { useAdminAudit } from "@/hooks/useAdminAudit"
import type { AuditEntry } from "@/hooks/useAdminAudit.types"

const PAGE_SIZE = 50

const formatMeta = (
  meta: AuditEntry["metadata"]
): string => {
  if (meta === null || meta === undefined) return ""
  return Object.entries(meta)
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(", ")
}

export const AdminAuditPage = () => {
  const [offset, setOffset] = useState(0)
  const [actionFilter, setActionFilter] = useState("")

  const { data, isLoading } = useAdminAudit({
    limit: PAGE_SIZE,
    offset,
    action: actionFilter || undefined,
  })

  const entries = data?.entries ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Audit Log</h1>
          <p className="text-sm text-muted-foreground">
            Recent actions taken by users on this panel.
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <Input
          className="max-w-xs"
          placeholder="Filter by action…"
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value)
            setOffset(0)
          }}
        />
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}

      <div className="rounded-lg border overflow-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground w-44">
                Time
              </th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                Action
              </th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                Actor
              </th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                Target
              </th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                Details
              </th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground w-28">
                IP
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {entries.length === 0 && !isLoading && (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  No entries found.
                </td>
              </tr>
            )}
            {entries.map((entry) => (
              <tr key={entry.id} className="hover:bg-muted/30">
                <td className="px-3 py-2 tabular-nums text-muted-foreground">
                  {new Date(entry.createdAt).toLocaleString()}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{entry.action}</td>
                <td className="px-3 py-2 font-mono text-xs">
                  {entry.actorId?.slice(0, 8) ?? "—"}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {entry.targetType && entry.targetId
                    ? `${entry.targetType}:${entry.targetId.slice(0, 8)}`
                    : "—"}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground max-w-xs truncate">
                  {formatMeta(entry.metadata)}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {entry.ip ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          disabled={offset === 0}
          onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
        >
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">
          Showing {offset + 1}–{offset + entries.length}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={entries.length < PAGE_SIZE}
          onClick={() => setOffset(offset + PAGE_SIZE)}
        >
          Next
        </Button>
      </div>
    </div>
  )
}

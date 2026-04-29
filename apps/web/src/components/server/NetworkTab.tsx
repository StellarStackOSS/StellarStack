import { useQuery } from "@tanstack/react-query"

import { apiFetch } from "@/lib/ApiFetch"
import { useServerLayout } from "@/components/ServerLayoutContext"
import type { AllocationRow } from "@/hooks/useAllocations.types"

/**
 * `/servers/$id/network` — the user-facing view of the server's bound
 * allocations. Read-only for now; the admin-side /admin nodes route owns
 * pool management.
 */
export const NetworkTab = () => {
  const { server } = useServerLayout()
  const allocations = useQuery({
    queryKey: ["admin", "nodes", server.nodeId, "allocations"],
    queryFn: () =>
      apiFetch<{ allocations: AllocationRow[] }>(
        `/admin/nodes/${server.nodeId}/allocations`
      ),
  })

  const bound = (allocations.data?.allocations ?? []).filter(
    (row) => row.serverId === server.id
  )

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-base font-semibold">Network</h1>
        <p className="text-muted-foreground text-xs">
          Allocations bound to this server. Game clients connect here.
        </p>
      </header>
      <section className="border-border bg-card text-card-foreground rounded-md border p-4">
        {allocations.isLoading ? (
          <p className="text-muted-foreground text-xs">Loading…</p>
        ) : bound.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            No allocations are bound. Reach out to an administrator if this
            server should be reachable on a port.
          </p>
        ) : (
          <ul className="flex flex-col gap-1 text-xs">
            {bound.map((row) => (
              <li
                key={row.id}
                className="border-border flex items-center justify-between rounded border px-2 py-1.5"
              >
                <code className="font-mono">
                  {row.ip}:{row.port}
                </code>
                {row.alias !== null && row.alias.length > 0 ? (
                  <span className="text-muted-foreground">{row.alias}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

import type { EventLogProps } from "@/components/EventLog.types"

const stateLabel: Record<EventLogProps["state"], string> = {
  closed: "disconnected",
  connecting: "connecting…",
  open: "live",
  reconnecting: "reconnecting…",
}

const stateDot: Record<EventLogProps["state"], string> = {
  closed: "bg-muted-foreground",
  connecting: "bg-chart-2",
  open: "bg-chart-1",
  reconnecting: "bg-destructive",
}

/**
 * Display panel-event frames as they arrive. Purely a smoke surface for
 * the M3 pipeline — replaced with real per-server views as features land.
 */
export const EventLog = ({ state, events }: EventLogProps) => {
  return (
    <section className="border-border bg-card text-card-foreground rounded-md border p-4">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium">Live events</h2>
        <span className="text-muted-foreground flex items-center gap-2 text-xs">
          <span className={`size-1.5 rounded-full ${stateDot[state]}`} />
          {stateLabel[state]}
        </span>
      </header>
      {events.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          Waiting for events. Trigger one with{" "}
          <code className="bg-muted rounded px-1 py-0.5">
            POST /admin/ping
          </code>
          .
        </p>
      ) : (
        <ol className="flex flex-col gap-2 font-mono text-xs">
          {events.map((event, index) => (
            <li
              key={`${event.at}-${index}`}
              className="border-border flex flex-col gap-1 rounded border px-2 py-1"
            >
              <span className="text-muted-foreground">{event.at}</span>
              <pre className="whitespace-pre-wrap break-all">
                {JSON.stringify(event, null, 2)}
              </pre>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

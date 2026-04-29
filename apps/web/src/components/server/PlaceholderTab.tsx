import type { ReactNode } from "react"

/**
 * Shared empty-state card used by tabs whose features land in later
 * milestones (Backups / Schedules / Users / Settings). Keeps the visual
 * layout consistent so the sidebar nav doesn't feel broken while the
 * features cook.
 */
export const PlaceholderTab = ({
  title,
  description,
  milestone,
}: {
  title: string
  description: ReactNode
  milestone?: string
}) => {
  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-base font-semibold">{title}</h1>
        {typeof description === "string" ? (
          <p className="text-muted-foreground text-xs">{description}</p>
        ) : (
          description
        )}
      </header>
      <section className="border-border bg-card text-card-foreground flex min-h-48 items-center justify-center rounded-md border p-6">
        <div className="text-muted-foreground text-center text-xs">
          <p className="mb-1">Coming soon{milestone ? ` (${milestone})` : ""}.</p>
          <p>This tab is wired into the layout already; the feature lands shortly.</p>
        </div>
      </section>
    </div>
  )
}

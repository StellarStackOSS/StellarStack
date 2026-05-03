/**
 * Dark gradient card used by all stat tiles on the server overview grid.
 * Replicates the v1 layered-border texture aesthetic.
 */
export const StatCard = ({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) => (
  <div
    className={[
      "relative flex h-full flex-col overflow-hidden rounded-xl",
      "bg-gradient-to-b from-[#1a1a1a] to-[#0d0d0d]",
      "border border-white/[0.07]",
      "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]",
      className ?? "",
    ]
      .filter(Boolean)
      .join(" ")}
  >
    {/* inner top-edge highlight */}
    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    {children}
  </div>
)

export const StatCardHeader = ({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) => (
  <div
    className={[
      "flex items-center justify-between px-4 pt-3 pb-1",
      className ?? "",
    ]
      .filter(Boolean)
      .join(" ")}
  >
    {children}
  </div>
)

export const StatCardTitle = ({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) => (
  <span
    className={[
      "text-[0.65rem] font-medium uppercase tracking-widest text-zinc-500",
      className ?? "",
    ]
      .filter(Boolean)
      .join(" ")}
  >
    {children}
  </span>
)

export const StatCardContent = ({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) => (
  <div
    className={["flex min-h-0 flex-1 flex-col px-4 pb-3", className ?? ""]
      .filter(Boolean)
      .join(" ")}
  >
    {children}
  </div>
)

export const StatCardFooter = ({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) => (
  <div
    className={[
      "flex items-center border-t border-white/[0.05] px-4 py-2 text-xs text-zinc-500",
      className ?? "",
    ]
      .filter(Boolean)
      .join(" ")}
  >
    {children}
  </div>
)

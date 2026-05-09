/**
 * Stat tile used on the server overview grid. Falls back to a flat
 * themed surface in light mode and keeps the dark-mode gradient + inner
 * highlight pattern that defines the v1 aesthetic.
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
      "bg-card dark:bg-gradient-to-b dark:from-[#1a1a1a] dark:to-[#0d0d0d]",
      "border border-border",
      "dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]",
      className ?? "",
    ]
      .filter(Boolean)
      .join(" ")}
  >
    {/* inner top-edge highlight (dark mode only) */}
    <div className="pointer-events-none absolute inset-x-0 top-0 hidden h-px bg-gradient-to-r from-transparent via-white/10 to-transparent dark:block" />
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
      "text-muted-foreground text-[0.65rem] font-medium uppercase tracking-widest",
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
      "text-muted-foreground flex items-center border-t border-border px-4 py-2 text-xs",
      className ?? "",
    ]
      .filter(Boolean)
      .join(" ")}
  >
    {children}
  </div>
)

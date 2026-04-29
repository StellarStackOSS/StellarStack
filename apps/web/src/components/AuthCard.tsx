import type { AuthCardProps } from "@/components/AuthCard.types"

/**
 * Centred card layout used by the login and register pages. Keeps the two
 * forms visually consistent without coupling them to each other.
 */
export const AuthCard = ({
  title,
  subtitle,
  footer,
  children,
}: AuthCardProps) => {
  return (
    <div className="bg-background flex min-h-svh items-center justify-center p-6">
      <div className="border-border bg-card text-card-foreground w-full max-w-sm rounded-lg border p-6 shadow-sm">
        <div className="mb-5">
          <h1 className="text-lg font-semibold">{title}</h1>
          {subtitle !== undefined ? (
            <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-3">{children}</div>
        {footer !== undefined ? (
          <div className="text-muted-foreground mt-6 text-xs">{footer}</div>
        ) : null}
      </div>
    </div>
  )
}

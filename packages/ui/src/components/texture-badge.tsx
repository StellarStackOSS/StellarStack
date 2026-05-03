import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@workspace/ui/lib/utils"

const outerVariants = cva("inline-block", {
  variants: {
    variant: {
      primary:   "bg-gradient-to-b from-black/70 to-black dark:from-white dark:to-white/80 p-[1px]",
      secondary: "bg-white/60 dark:bg-zinc-600/50 p-[1px]",
      success:   "bg-gradient-to-b from-emerald-300/90 to-emerald-500 dark:from-emerald-300/70 dark:to-emerald-600 p-[1px]",
      warning:   "bg-gradient-to-b from-amber-300/90 to-amber-500 dark:from-amber-300/70 dark:to-amber-600 p-[1px]",
      destructive: "bg-gradient-to-b from-red-300/90 to-red-500 dark:from-red-300/90 dark:to-red-500 p-[1px]",
      accent:    "bg-gradient-to-b from-indigo-300/90 to-indigo-500 dark:from-indigo-200/70 dark:to-indigo-500 p-[1px]",
      ghost:     "border border-transparent bg-transparent p-[1px]",
    },
    size: {
      sm:      "rounded-[4px]",
      default: "rounded-[6px]",
      lg:      "rounded-[8px]",
    },
  },
  defaultVariants: { variant: "primary", size: "default" },
})

const innerVariants = cva(
  "inline-flex items-center justify-center gap-1 whitespace-nowrap text-xs font-medium px-2 py-0.5",
  {
    variants: {
      variant: {
        primary:     "bg-gradient-to-b from-zinc-800 to-black dark:from-zinc-200 dark:to-zinc-50 text-white/90 dark:text-black/80",
        secondary:   "bg-gradient-to-b from-zinc-100/80 to-zinc-200/50 dark:from-zinc-800 dark:to-zinc-700/50 text-zinc-900 dark:text-zinc-200",
        success:     "bg-gradient-to-b from-emerald-400 to-emerald-600 text-white/95",
        warning:     "bg-gradient-to-b from-amber-400 to-amber-600 text-black/90",
        destructive: "bg-gradient-to-b from-red-400/60 to-red-500/60 text-white/90",
        accent:      "bg-gradient-to-b from-indigo-400 to-indigo-600 text-white/90",
        ghost:       "bg-transparent text-zinc-400",
      },
      size: {
        sm:      "rounded-[3px]",
        default: "rounded-[5px]",
        lg:      "rounded-[7px]",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  }
)

type TextureBadgeProps = React.ComponentProps<"span"> &
  VariantProps<typeof outerVariants>

const TextureBadge = ({ className, variant, size, children, ...props }: TextureBadgeProps) => {
  return (
    <span className={cn(outerVariants({ variant, size }), className)} {...props}>
      <span className={cn(innerVariants({ variant, size }))}>{children}</span>
    </span>
  )
}

TextureBadge.displayName = "TextureBadge"

export { TextureBadge }

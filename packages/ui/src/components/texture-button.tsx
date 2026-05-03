import * as React from "react"
import { Slot } from "radix-ui"
import { cva } from "class-variance-authority"
import { cn } from "@workspace/ui/lib/utils"

const outerVariants = cva("transition-all duration-300 cursor-pointer", {
  variants: {
    variant: {
      primary:
        "disabled:opacity-50 disabled:cursor-not-allowed border border-black/10 dark:border-[2px] dark:border-black bg-gradient-to-b from-black/70 to-black dark:from-white dark:to-white/80 p-[1px]",
      secondary:
        "disabled:opacity-50 disabled:cursor-not-allowed border dark:border-[2px] border-black/20 bg-white/50 dark:border-zinc-950 dark:bg-zinc-600/50 p-[1px]",
      destructive:
        "disabled:opacity-50 disabled:cursor-not-allowed border dark:border-[2px] border-black/10 dark:border-zinc-950 bg-gradient-to-b from-red-300/90 to-red-500 dark:from-red-300/90 dark:to-red-500 p-[1px]",
      minimal:
        "disabled:opacity-50 disabled:cursor-not-allowed group border dark:border border-black/20 dark:border-zinc-950 bg-white/50 dark:bg-zinc-600/80 p-[1px] hover:bg-gradient-to-t hover:from-zinc-100 hover:to-white dark:hover:from-zinc-600/50 dark:hover:to-zinc-600/70",
      ghost:
        "disabled:opacity-50 disabled:cursor-not-allowed border border-transparent bg-transparent p-[1px] hover:bg-zinc-100/40 dark:hover:bg-zinc-800/40",
      success:
        "disabled:opacity-50 disabled:cursor-not-allowed border dark:border-[2px] border-black/10 dark:border-zinc-950 bg-gradient-to-b from-emerald-300/90 to-emerald-500 dark:from-emerald-300/70 dark:to-emerald-600 p-[1px]",
      warning:
        "disabled:opacity-50 disabled:cursor-not-allowed border dark:border-[2px] border-black/10 dark:border-zinc-950 bg-gradient-to-b from-amber-300/90 to-amber-500 dark:from-amber-300/70 dark:to-amber-600 p-[1px]",
      accent:
        "disabled:opacity-50 disabled:cursor-not-allowed border dark:border-[2px] border-black/10 dark:border-zinc-950 bg-gradient-to-b from-indigo-300/90 to-indigo-500 dark:from-indigo-200/70 dark:to-indigo-500 p-[1px]",
    },
    size: {
      sm: "rounded-[8px] text-xs",
      default: "rounded-[8px]",
      lg: "rounded-[12px]",
    },
  },
  defaultVariants: { variant: "primary", size: "default" },
})

const innerVariants = cva(
  "w-full h-full flex items-center justify-center gap-2 transition-all duration-300",
  {
    variants: {
      variant: {
        primary:
          "bg-gradient-to-b from-zinc-800 to-black dark:from-zinc-200 dark:to-zinc-50 text-white/90 dark:text-black/80 hover:from-stone-800 hover:to-zinc-800/70 dark:hover:from-stone-200 dark:hover:to-zinc-200",
        secondary:
          "bg-gradient-to-b from-zinc-100/80 to-zinc-200/50 dark:from-zinc-800 dark:to-zinc-700/50 hover:from-zinc-200/40 hover:to-zinc-300/60",
        destructive:
          "bg-gradient-to-b from-red-400/60 to-red-500/60 text-white/90 hover:from-red-400/70 hover:to-red-600/70",
        minimal:
          "bg-gradient-to-b from-white to-zinc-50/50 dark:from-zinc-800 dark:to-zinc-700/50 group-hover:from-zinc-50/50 group-hover:to-zinc-100/60 dark:group-hover:from-zinc-700 dark:group-hover:to-zinc-700/60",
        ghost:
          "bg-transparent text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100",
        success:
          "bg-gradient-to-b from-emerald-400 to-emerald-600 text-white/95 hover:from-emerald-400/80 hover:to-emerald-600/80",
        warning:
          "bg-gradient-to-b from-amber-400 to-amber-600 text-black/90 hover:from-amber-400/80 hover:to-amber-600/80",
        accent:
          "bg-gradient-to-b from-indigo-400 to-indigo-600 text-white/90 hover:from-indigo-400/70 hover:to-indigo-600/70",
      },
      size: {
        sm: "rounded-[7px] px-3 py-1 text-xs",
        default: "rounded-[7px] px-4 py-2 text-sm",
        lg: "rounded-[11px] px-4 py-2 text-base",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  }
)

export interface TextureButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "destructive" | "minimal" | "ghost" | "success" | "warning" | "accent"
  size?: "sm" | "default" | "lg"
  asChild?: boolean
}

const TextureButton = React.forwardRef<HTMLButtonElement, TextureButtonProps>(
  ({ children, variant = "primary", size = "default", asChild = false, className, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot.Root : "button"
    return (
      <Comp
        ref={ref}
        className={cn(outerVariants({ variant, size }), className)}
        disabled={disabled}
        {...props}
      >
        <div className={cn(innerVariants({ variant, size }))}>{children}</div>
      </Comp>
    )
  }
)

TextureButton.displayName = "TextureButton"

export { TextureButton }

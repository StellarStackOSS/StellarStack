"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "@stellarUI/lib/Utils";

const buttonVariantsOuter = cva("transition-all duration-300", {
  variants: {
    variant: {
      primary:
        "transition-all disabled:opacity-50 disabled:cursor-not-allowed duration-300 border border-[1px] dark:border-[2px] border-black/10 dark:border-black bg-gradient-to-b from-black/70 to-black dark:from-white dark:to-white/80 p-[1px] ease-in-out",

      accent:
        "transition-all disabled:opacity-50 disabled:cursor-not-allowed duration-300 border-[1px] dark:border-[2px] border-black/10 dark:border-neutral-950 bg-gradient-to-b from-indigo-300/90 to-indigo-500 dark:from-indigo-200/70 dark:to-indigo-500 p-[1px] ease-in-out",

      destructive:
        "transition-all disabled:opacity-50 disabled:cursor-not-allowed duration-300 border-[1px] dark:border-[2px] border-black/10 dark:border-neutral-950 bg-gradient-to-b from-red-300/90 to-red-500 dark:from-red-300/90 dark:to-red-500 p-[1px] ease-in-out",

      secondary:
        "transition-all disabled:opacity-50 disabled:cursor-not-allowed duration-300 border-[1px] dark:border-[2px] border-black/20 bg-white/50 dark:border-neutral-950 dark:bg-neutral-600/50 p-[1px] ease-in-out",

      minimal:
        "transition-all disabled:opacity-50 disabled:cursor-not-allowed duration-300 group border-[1px] dark:border-[1px] border-black/20 dark:border-neutral-950 bg-white/50 dark:bg-neutral-600/80 p-[1px] hover:bg-gradient-to-t hover:from-neutral-100 hover:to-white dark:hover:from-neutral-600/50 dark:hover:to-neutral-600/70 active:bg-neutral-200 dark:active:bg-neutral-800",

      icon: "transition-all disabled:opacity-50 disabled:cursor-not-allowed duration-300 group rounded-full border border-black/10 dark:border-neutral-950 bg-white/50 dark:bg-neutral-600/50 p-[1px] hover:bg-gradient-to-t hover:from-neutral-100 hover:to-white dark:hover:from-neutral-700 dark:hover:to-neutral-600 active:bg-neutral-200 dark:active:bg-neutral-800",

      ghost:
        "transition-all disabled:opacity-50 disabled:cursor-not-allowed duration-300 border border-transparent bg-transparent p-[1px] hover:bg-neutral-100/40 dark:hover:bg-neutral-800/40",

      success:
        "transition-all disabled:opacity-50 disabled:cursor-not-allowed duration-300 border-[1px] dark:border-[2px] border-black/10 dark:border-neutral-950 bg-gradient-to-b from-emerald-300/90 to-emerald-500 dark:from-emerald-300/70 dark:to-emerald-600 p-[1px] ease-in-out",

      warning:
        "transition-all disabled:opacity-50 disabled:cursor-not-allowed duration-300 border-[1px] dark:border-[2px] border-black/10 dark:border-neutral-950 bg-gradient-to-b from-amber-300/90 to-amber-500 dark:from-amber-300/70 dark:to-amber-600 p-[1px] ease-in-out",

      disabled:
        "border disabled:opacity-50 disabled:cursor-not-allowed border-black/10 dark:border-neutral-900 bg-neutral-200/60 dark:bg-neutral-800/60 p-[1px] opacity-60 cursor-not-allowed pointer-events-none",
    },
    size: {
      sm: "rounded-[8px] text-xs",
      default: "rounded-[8px] w-fit",
      lg: "rounded-[12px]",
      icon: "rounded-full",
    },
  },
  defaultVariants: {
    variant: "primary",
    size: "default",
  },
});

const innerDivVariants = cva(
  "w-full h-full flex items-center justify-center transition-all duration-300",
  {
    variants: {
      variant: {
        primary:
          "transition-all duration-300 gap-2 bg-gradient-to-b from-neutral-800 to-black dark:from-neutral-200 dark:to-neutral-50 text-sm text-white/90 dark:text-black/80 hover:from-stone-800 hover:to-neutral-800/70 dark:hover:from-stone-200 dark:hover:to-neutral-200 active:from-black active:to-black",

        accent:
          "transition-all duration-300 gap-2 bg-gradient-to-b from-indigo-400 to-indigo-600 text-sm text-white/90 hover:from-indigo-400/70 hover:to-indigo-600/70 active:from-indigo-400/80 active:to-indigo-600/80",

        destructive:
          "transition-all duration-300 gap-2 bg-gradient-to-b from-red-400/60 to-red-500/60 text-sm text-white/90 hover:from-red-400/70 hover:to-red-600/70 active:from-red-400/80 active:to-red-600/80",

        secondary:
          "transition-all duration-300 gap-2 bg-gradient-to-b from-neutral-100/80 to-neutral-200/50 dark:from-neutral-800 dark:to-neutral-700/50 text-sm hover:from-neutral-200/40 hover:to-neutral-300/60 active:from-neutral-200/60 active:to-neutral-300/70",

        minimal:
          "transition-all gap-2 duration-300 bg-gradient-to-b from-white to-neutral-50/50 dark:from-neutral-800 dark:to-neutral-700/50 text-sm group-hover:from-neutral-50/50 group-hover:to-neutral-100/60 dark:group-hover:from-neutral-700 dark:group-hover:to-neutral-700/60 group-active:from-neutral-100/60 group-active:to-neutral-100/90",

        icon: "transition-all duration-300 bg-gradient-to-b from-white to-neutral-50/50 dark:from-neutral-800 dark:to-neutral-700/50 rounded-full group-active:bg-neutral-200 dark:group-active:bg-neutral-800",

        ghost:
          "transition-all gap-2 duration-300 bg-transparent text-sm text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100",

        success:
          "transition-all duration-300 gap-2 bg-gradient-to-b from-emerald-400 to-emerald-600 text-sm text-white/95 hover:from-emerald-400/80 hover:to-emerald-600/80 active:from-emerald-500 active:to-emerald-700",

        warning:
          "transition-all duration-300 gap-2 bg-gradient-to-b from-amber-400 to-amber-600 text-sm text-black/90 hover:from-amber-400/80 hover:to-amber-600/80 active:from-amber-500 active:to-amber-700",

        disabled: "bg-transparent text-sm text-neutral-400 dark:text-neutral-500",
      },
      size: {
        sm: "text-xs rounded-[10px] px-4 py-1",
        default: "text-sm rounded-[10px] px-4 py-2",
        lg: "text-base rounded-[10px] px-4 py-2",
        icon: "rounded-full p-1",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
);

export interface UnifiedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "primary"
    | "secondary"
    | "accent"
    | "destructive"
    | "minimal"
    | "icon"
    | "ghost"
    | "success"
    | "warning"
    | "disabled";
  size?: "default" | "sm" | "lg" | "icon";
  asChild?: boolean;
}

const TextureButton = React.forwardRef<HTMLButtonElement, UnifiedButtonProps>(
  (
    {
      children,
      variant = "primary",
      size = "default",
      asChild = false,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        ref={ref}
        className={cn(buttonVariantsOuter({ variant, size }), "cursor-pointer", className)}
        disabled={disabled || variant === "disabled"}
        {...props}
      >
        <div className={cn(innerDivVariants({ variant, size }))}>{children}</div>
      </Comp>
    );
  }
);

TextureButton.displayName = "TextureButton";

export { TextureButton };

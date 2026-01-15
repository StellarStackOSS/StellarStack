import { ComponentPropsWithoutRef } from "react";
import { cn } from "@workspace/ui/lib/utils";

type CardProps = ComponentPropsWithoutRef<"div"> & { isDark?: boolean };

const UsageCardTitle = ({ className, children, isDark = true, ...props }: CardProps) => {
  return (
    <div
      className={cn(
        "mb-6 text-2xl font-light",
        isDark ? "text-zinc-100" : "text-zinc-800",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

const UsageCardContent = ({ className, children, ...props }: CardProps) => {
  return (
    <div className={cn("flex flex-1 flex-col space-y-4", className)} {...props}>
      {children}
    </div>
  );
};

const UsageCardFooter = ({ className, children, isDark = true, ...props }: CardProps) => {
  return (
    <div
      className={cn(
        "mt-6 border-t pt-4 text-sm",
        isDark ? "border-zinc-700 text-zinc-400" : "border-zinc-300 text-zinc-600",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

const UsageCard = ({ className, children, isDark = true, ...props }: CardProps) => {
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-lg border p-8 transition-colors",
        isDark
          ? "border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] shadow-lg shadow-black/20"
          : "border-zinc-300 bg-gradient-to-b from-white via-zinc-50 to-zinc-100 shadow-lg shadow-zinc-400/20",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

UsageCard.Title = UsageCardTitle;
UsageCard.Content = UsageCardContent;
UsageCard.Footer = UsageCardFooter;

export { UsageCard, UsageCardContent, UsageCardTitle, UsageCardFooter };

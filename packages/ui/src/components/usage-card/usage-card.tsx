import { ComponentPropsWithoutRef } from "react";
import { cn } from "@workspace/ui/lib/utils";

type CardProps = ComponentPropsWithoutRef<"div">;

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

const UsageCardFooter = ({ className, children, ...props }: CardProps) => {
    return (
        <div
            className={cn(
                "mt-6 pt-4 border-t text-sm",
                "border-zinc-700 text-zinc-400",
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
};

const UsageCard = ({ className, children, ...props }: CardProps) => {
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-lg border p-8 transition-colors border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] shadow-lg shadow-black/20",
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

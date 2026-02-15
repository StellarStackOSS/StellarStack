import { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@stellarUI/lib/Utils";
import { InfoTooltip } from "@stellarUI/components/InfoTooltip/InfoTooltip";

type CardProps = ComponentPropsWithoutRef<"div">;

const UsageCardTitle = ({ className, children, ...props }: CardProps) => {
  return (
    <div className={cn("mb-6 text-2xl font-light text-zinc-100", className)} {...props}>
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
      className={cn("mt-6 border-t pt-4 text-sm", "border-zinc-700 text-zinc-400", className)}
      {...props}
    >
      {children}
    </div>
  );
};

interface UsageCardProps extends Omit<CardProps, "title"> {
  title?: string;
  tooltipContent?: ReactNode;
}

const UsageCard = ({ className, children, title, tooltipContent, ...props }: UsageCardProps) => {
  return (
    <div className="flex h-full flex-col rounded-lg border border-white/5 bg-[#090909] p-1 pt-2">
      {title && (
        <div className="flex shrink-0 flex-row justify-between pb-2 pl-2 text-xs opacity-50">
          <span>{title}</span>
          {tooltipContent && <InfoTooltip content={tooltipContent} />}
        </div>
      )}
      <div
        className={cn(
          "relative flex flex-1 flex-col rounded-lg border border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] p-4 shadow-lg shadow-black/20 transition-colors",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </div>
  );
};

UsageCard.Title = UsageCardTitle;
UsageCard.Content = UsageCardContent;
UsageCard.Footer = UsageCardFooter;

export { UsageCardContent, UsageCardTitle, UsageCardFooter };
export default UsageCard;
